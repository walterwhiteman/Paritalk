# signaling_server.py
# This script runs a WebSocket signaling server using Flask-SocketIO.
# It facilitates WebRTC peer connections by relaying signaling messages
# (ICE candidates and SDP offers/answers) between users in specific rooms.
# Now includes explicit call invite/accept/reject logic with robust user tracking.

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import random
import string

app = Flask(__name__)
# Configure SocketIO to allow connections from any origin, crucial for development.
# For production, replace '*' with your specific frontend domain(s).
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your_super_secret_key') # Use environment variable for production
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent', logger=True, engineio_logger=True)

# Dictionary to keep track of active WebRTC call rooms and their participants
# Format: {call_id: {webrtc_user_id: {'socket_id': socket_id, 'username': username, 'chat_user_id': chat_user_id}, ...}}
active_webrtc_call_rooms = {}

# Dictionary to map Firebase chat_user_id to current socket_id (for direct invites)
# This mapping is crucial for initiating calls to specific chat users.
# Format: {chat_user_id: socket_id}
chat_user_to_socket = {}

# Dictionary to store basic user info by socket_id (for cleanup and logging)
# This helps track who is connected and what their roles/IDs are.
# Format: {socket_id: {'username': str, 'chat_user_id': str, 'webrtc_user_id': str, 'current_webrtc_room': str | None}}
connected_clients_info = {}


@app.route('/')
def index():
    """Simple health check endpoint."""
    return "WebRTC Signaling Server is running!"

@socketio.on('connect')
def handle_connect():
    """Handle new client connections."""
    print(f"Client connected: {request.sid}")
    connected_clients_info[request.sid] = {
        'username': 'unknown',
        'chat_user_id': 'unknown',
        'webrtc_user_id': 'unknown',
        'current_webrtc_room': None # The call ID they are currently in (or inviting/being invited to)
    }

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnections."""
    print(f"Client disconnected: {request.sid}")

    user_info = connected_clients_info.pop(request.sid, {})
    username = user_info.get('username', 'unknown')
    chat_user_id = user_info.get('chat_user_id', 'unknown')
    webrtc_user_id = user_info.get('webrtc_user_id', 'unknown')
    current_webrtc_room = user_info.get('current_webrtc_room')

    # Remove from chat_user_to_socket mapping
    # Check if the disconnected socket was the one registered for this chat_user_id
    if chat_user_id in chat_user_to_socket and chat_user_to_socket[chat_user_id] == request.sid:
        del chat_user_to_socket[chat_user_id]
        print(f"Removed chat user {username} ({chat_user_id}) from chat_user_to_socket mapping on disconnect.")

    # Clean up from active WebRTC call rooms
    if current_webrtc_room and current_webrtc_room in active_webrtc_call_rooms:
        if webrtc_user_id in active_webrtc_call_rooms[current_webrtc_room]:
            del active_webrtc_call_rooms[current_webrtc_room][webrtc_user_id]
            print(f"WebRTC user {username} ({webrtc_user_id}) removed from call room {current_webrtc_room}.")

            # If the room becomes empty, remove it
            if not active_webrtc_call_rooms[current_webrtc_room]:
                del active_webrtc_call_rooms[current_webrtc_room]
                print(f"WebRTC Room {current_webrtc_room} is now empty and removed.")
            else:
                # Notify remaining participants in the WebRTC room about the user leaving
                print(f"Notifying WebRTC room {current_webrtc_room} about {username} leaving.")
                emit('user_left', {
                    'userId': webrtc_user_id,
                    'username': username,
                    'chat_user_id': chat_user_id # Pass chat_user_id for more context
                }, room=current_webrtc_room) # Emit to the room, excluding the disconnected socket is implicit by room-level emit

@socketio.on('register_chat_user')
def handle_register_chat_user(data):
    """
    Registers a client's socket ID with their Firebase chat user ID.
    This allows direct targeting for call invitations.
    data: {'chatUserId': 'firebase_uid', 'username': 'user_display_name'}
    """
    chat_user_id = data.get('chatUserId')
    username = data.get('username')
    
    if chat_user_id and username:
        # Update mapping
        chat_user_to_socket[chat_user_id] = request.sid
        # Update client info
        connected_clients_info[request.sid]['chat_user_id'] = chat_user_id
        connected_clients_info[request.sid]['username'] = username
        print(f"Chat user {username} ({chat_user_id}) registered with socket {request.sid}")
    else:
        print(f"Failed to register chat user: Missing chatUserId or username from {request.sid} for registration.")


@socketio.on('join_room')
def handle_join_room(data):
    """
    Handle a user attempting to join a specific WebRTC call room.
    The room_code here is the unique callId.
    data should contain: {'roomCode': 'callId', 'userId': 'webrtc_unique_id', 'username': 'JohnDoe'}
    """
    room_code = data.get('roomCode') # This is the callId
    webrtc_user_id = data.get('userId')    # This is the unique WebRTC client ID
    username = data.get('username')

    if not room_code or not webrtc_user_id or not username:
        emit('join_failed', {'message': 'Missing roomCode, userId, or username.'})
        return

    # Check if the room_code is for initial connection or an actual call
    if not room_code.startswith('initial_room_'):
        # Before joining, check if room is full for 1-on-1 calls
        if room_code in active_webrtc_call_rooms and len(active_webrtc_call_rooms[room_code]) >= 2:
            print(f"WebRTC Room {room_code} is full. User {username} cannot join.")
            emit('room_full', {'message': 'This call is already full.'}, room=request.sid)
            return

    join_room(room_code)
    print(f"User {username} ({webrtc_user_id}) joined WebRTC room {room_code} with socket ID {request.sid}")

    if room_code not in active_webrtc_call_rooms:
        active_webrtc_call_rooms[room_code] = {}

    # Store user info in the active call room
    active_webrtc_call_rooms[room_code][webrtc_user_id] = {
        'socket_id': request.sid,
        'username': username,
        'userId': webrtc_user_id, # Store the internal WebRTC userId
        'chat_user_id': connected_clients_info.get(request.sid, {}).get('chat_user_id', 'unknown_chat_id') # Get associated chat_user_id
    }

    # Update client info for this socket
    connected_clients_info[request.sid]['webrtc_user_id'] = webrtc_user_id
    connected_clients_info[request.sid]['current_webrtc_room'] = room_code

    peers_in_room = []
    for existing_webrtc_user_id, existing_user_info in active_webrtc_call_rooms[room_code].items():
        if existing_webrtc_user_id != webrtc_user_id:
            peers_in_room.append({
                'userId': existing_user_info['userId'],
                'username': existing_user_info['username'],
                'socketId': existing_user_info['socket_id'],
                'chat_user_id': existing_user_info['chat_user_id']
            })
            # Notify the existing peer about the new user joining
            emit('user_joined', {
                'userId': webrtc_user_id,
                'username': username,
                'socketId': request.sid,
                'chat_user_id': connected_clients_info.get(request.sid, {}).get('chat_user_id', 'unknown_chat_id')
            }, room=existing_user_info['socket_id'])

    # Send the list of existing peers to the newly joined user
    emit('room_joined', {'roomCode': room_code, 'peers': peers_in_room}, room=request.sid)

    print(f"Current participants in WebRTC room {room_code}: {list(active_webrtc_call_rooms[room_code].keys())}")


@socketio.on('leave_room')
def handle_leave_room(data):
    """
    Handle a user explicitly leaving a WebRTC call room.
    data should contain: {'roomCode': 'callId', 'userId': 'webrtc_unique_id'}
    """
    room_code = data.get('roomCode')
    webrtc_user_id = data.get('userId')

    if room_code in active_webrtc_call_rooms and webrtc_user_id in active_webrtc_call_rooms[room_code]:
        leave_room(room_code)
        leaving_user_info = active_webrtc_call_rooms[room_code][webrtc_user_id]
        leaving_user_username = leaving_user_info['username']
        leaving_chat_user_id = leaving_user_info['chat_user_id']

        del active_webrtc_call_rooms[room_code][webrtc_user_id]
        print(f"User {leaving_user_username} ({webrtc_user_id}) explicitly left WebRTC room {room_code}.")

        if not active_webrtc_call_rooms[room_code]:
            del active_webrtc_call_rooms[room_code]
            print(f"WebRTC Room {room_code} is now empty and removed.")
        else:
            # Notify remaining participants
            emit('user_left', {
                'userId': webrtc_user_id,
                'username': leaving_user_username,
                'chat_user_id': leaving_chat_user_id
            }, room=room_code)
    
    # Reset current_webrtc_room in connected_clients_info for the departing socket
    if request.sid in connected_clients_info:
        connected_clients_info[request.sid]['current_webrtc_room'] = None


# --- Call Invitation/Response Signaling ---

@socketio.on('initiate_call_signal')
def handle_initiate_call_signal(data):
    """
    Initiator sends this to invite a specific chat user to a call.
    data: {'callId': 'unique_call_id', 'callerUsername': 'initiator_name',
           'callerChatUserId': 'firebase_uid_caller', 'recipientChatUserId': 'firebase_uid_recipient'}
    """
    call_id = data.get('callId')
    caller_username = data.get('callerUsername')
    caller_chat_user_id = data.get('callerChatUserId') # This is the chat user ID of the caller's client
    recipient_chat_user_id = data.get('recipientChatUserId') # This is the Firebase chat UID of the target.

    if not all([call_id, caller_username, caller_chat_user_id, recipient_chat_user_id]):
        print("Missing data for initiate_call_signal.")
        return

    recipient_socket_id = chat_user_to_socket.get(recipient_chat_user_id)
    if recipient_socket_id:
        print(f"Sending incoming_call to {recipient_chat_user_id} ({recipient_socket_id}) from {caller_username}")
        emit('incoming_call', {
            'callId': call_id,
            'callerUsername': caller_username,
            'callerChatUserId': caller_chat_user_id, # Pass chat_user_id of caller
            'callerSocketId': request.sid # Send initiator's socket ID for direct response
        }, room=recipient_socket_id)
    else:
        print(f"Recipient {recipient_chat_user_id} not online or not registered with signaling server (socket ID unknown).")
        # Optionally, send a 'recipient_offline' signal back to the caller
        emit('recipient_offline', {'recipientId': recipient_chat_user_id}, room=request.sid)

@socketio.on('accept_call_signal')
def handle_accept_call_signal(data):
    """
    Recipient sends this back to the initiator after accepting the call.
    data: {'recipientSocketId': 'initiator_socket_id', 'acceptorUsername': 'recipient_name'}
    """
    caller_socket_id = data.get('recipientSocketId') # This is the initiator's socket
    acceptor_username = data.get('acceptorUsername')
    if caller_socket_id and caller_socket_id in connected_clients_info:
        print(f"Call accepted by {acceptor_username}, notifying caller {caller_socket_id}")
        emit('call_accepted_signal', {'acceptorUsername': acceptor_username}, room=caller_socket_id)
    else:
        print(f"Missing or invalid callerSocketId ({caller_socket_id}) for accept_call_signal.")

@socketio.on('reject_call_signal')
def handle_reject_call_signal(data):
    """
    Recipient sends this back to the initiator after rejecting/cancelling the call.
    data: {'callerSocketId': 'initiator_socket_id', 'rejecterUsername': 'recipient_name'}
    """
    caller_socket_id = data.get('callerSocketId')
    rejecter_username = data.get('rejecterUsername')
    if caller_socket_id and caller_socket_id in connected_clients_info:
        print(f"Call rejected by {rejecter_username}, notifying caller {caller_socket_id}")
        emit('call_rejected_signal', {'rejecterUsername': rejecter_username}, room=caller_socket_id)
    else:
        print(f"Missing or invalid callerSocketId ({caller_socket_id}) for reject_call_signal.")

@socketio.on('cancel_call_signal')
def handle_cancel_call_signal(data):
    """
    Initiator sends this if they cancel the call before it's accepted by recipient.
    data: {'recipientSocketId': 'recipient_socket_id', 'cancellerUsername': 'initiator_name'}
    """
    recipient_socket_id = data.get('recipientSocketId')
    canceller_username = data.get('cancellerUsername')
    if recipient_socket_id and recipient_socket_id in connected_clients_info:
        print(f"Call cancelled by {canceller_username}, notifying recipient {recipient_socket_id}")
        emit('call_cancelled', {'cancellerUsername': canceller_username}, room=recipient_socket_id)
    else:
        print(f"Missing or invalid recipientSocketId ({recipient_socket_id}) for cancel_call_signal.")


# --- WebRTC Signal Relays ---

@socketio.on('offer')
def handle_offer(data):
    """
    Relay a WebRTC SDP offer from one peer to another.
    data should contain: {'recipientSocketId': 'socket_id_of_peer', 'offer': {...}}
    """
    recipient_socket_id = data.get('recipientSocketId')
    offer = data.get('offer')
    if recipient_socket_id and offer:
        print(f"Relaying offer from {request.sid} to {recipient_socket_id}")
        emit('offer', {'senderSocketId': request.sid, 'offer': offer}, room=recipient_socket_id)
    else:
        print(f"Invalid offer data from {request.sid}: {data}")

@socketio.on('answer')
def handle_answer(data):
    """
    Relay a WebRTC SDP answer from one peer to another.
    data should contain: {'recipientSocketId': 'socket_id_of_peer', 'answer': {...}}
    """
    recipient_socket_id = data.get('recipientSocketId')
    answer = data.get('answer')
    if recipient_socket_id and answer:
        print(f"Relaying answer from {request.sid} to {recipient_socket_id}")
        emit('answer', {'senderSocketId': request.sid, 'answer': answer}, room=recipient_socket_id)
    else:
        print(f"Invalid answer data from {request.sid}: {data}")

@socketio.on('ice_candidate')
def handle_ice_candidate(data):
    """
    Relay an ICE candidate from one peer to another.
    data should contain: {'recipientSocketId': 'socket_id_of_peer', 'candidate': {...}}
    """
    recipient_socket_id = data.get('recipientSocketId')
    candidate = data.get('candidate')
    if recipient_socket_id and candidate:
        print(f"Relaying ICE candidate from {request.sid} to {recipient_socket_id}")
        emit('ice_candidate', {'senderSocketId': request.sid, 'candidate': candidate}, room=recipient_socket_id)
    else:
        print(f"Invalid ICE candidate data from {request.sid}: {data}")

if __name__ == '__main__':
    print("Starting Flask-SocketIO signaling server on port 5000...")
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True) # allow_unsafe_werkzeug for dev only
