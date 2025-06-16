# signaling_server.py
# This script runs a WebSocket signaling server using Flask-SocketIO.
# It facilitates WebRTC peer connections by relaying signaling messages
# (ICE candidates and SDP offers/answers) between users in specific rooms.

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

# Dictionary to keep track of active rooms and their participants
# Format: {room_code: {user_id: socket_id, user_id: socket_id, ...}}
active_rooms = {}
# Dictionary to store username by socket_id
users_by_socket_id = {}

@app.route('/')
def index():
    """Simple health check endpoint."""
    return "WebRTC Signaling Server is running!"

@socketio.on('connect')
def handle_connect():
    """Handle new client connections."""
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnections."""
    print(f"Client disconnected: {request.sid}")
    user_id = None
    room_code = None

    # Find which room the disconnected user was in
    for r_code, participants in active_rooms.items():
        for u_id, s_id in list(participants.items()): # Use list to avoid RuntimeError during deletion
            if s_id == request.sid:
                user_id = u_id
                room_code = r_code
                break
        if user_id:
            break

    if user_id and room_code:
        # Remove user from the room
        del active_rooms[room_code][user_id]
        print(f"User {user_id} removed from room {room_code} on disconnect.")

        # Clean up empty rooms
        if not active_rooms[room_code]:
            del active_rooms[room_code]
            print(f"Room {room_code} is now empty and removed.")
        else:
            # Notify remaining participants in the room about the user leaving
            # Get the username of the disconnected user
            disconnected_username = users_by_socket_id.get(request.sid, "A user")
            print(f"Notifying room {room_code} about {disconnected_username} leaving.")
            emit('user_left', {'userId': user_id, 'username': disconnected_username}, room=room_code)

    if request.sid in users_by_socket_id:
        del users_by_socket_id[request.sid]

@socketio.on('join_room')
def handle_join_room(data):
    """
    Handle a user attempting to join a specific room for video calls.
    data should contain: {'roomCode': 'XYZ', 'userId': 'abc', 'username': 'JohnDoe'}
    """
    room_code = data.get('roomCode')
    user_id = data.get('userId')
    username = data.get('username')

    if not room_code or not user_id or not username:
        emit('join_failed', {'message': 'Missing roomCode, userId, or username.'})
        return

    join_room(room_code)
    print(f"User {username} ({user_id}) joined room {room_code} with socket ID {request.sid}")

    users_by_socket_id[request.sid] = username

    if room_code not in active_rooms:
        active_rooms[room_code] = {}

    # Check if the room already has 2 participants (for 1-on-1 calls)
    if len(active_rooms[room_code]) >= 2:
        print(f"Room {room_code} is full. User {username} cannot join for video.")
        # Optionally, kick the new user or signal a "room full" error
        emit('room_full', {'message': 'This room is currently full.'})
        # Important: Leave the room if it's full, so they don't receive signals
        leave_room(room_code)
        return

    active_rooms[room_code][user_id] = request.sid

    # Notify existing participants in the room about the new user
    # Also, send the new user info about existing participants
    peers_in_room = []
    for existing_user_id, existing_socket_id in active_rooms[room_code].items():
        if existing_user_id != user_id:
            peers_in_room.append({
                'userId': existing_user_id,
                'username': users_by_socket_id.get(existing_socket_id, "Unknown"),
                'socketId': existing_socket_id
            })
            # Notify the existing peer about the new user joining
            emit('user_joined', {'userId': user_id, 'username': username, 'socketId': request.sid}, room=existing_socket_id)

    # Send the list of existing peers to the newly joined user
    emit('room_joined', {'roomCode': room_code, 'peers': peers_in_room})

    print(f"Current participants in room {room_code}: {list(active_rooms[room_code].keys())}")

@socketio.on('leave_room')
def handle_leave_room(data):
    """
    Handle a user explicitly leaving a room.
    data should contain: {'roomCode': 'XYZ', 'userId': 'abc'}
    """
    room_code = data.get('roomCode')
    user_id = data.get('userId')

    if room_code in active_rooms and user_id in active_rooms[room_code]:
        leave_room(room_code)
        del active_rooms[room_code][user_id]
        print(f"User {user_id} explicitly left room {room_code}.")

        if not active_rooms[room_code]:
            del active_rooms[room_code]
            print(f"Room {room_code} is now empty and removed.")
        else:
            # Notify remaining participants
            username_leaving = users_by_socket_id.get(request.sid, "A user")
            emit('user_left', {'userId': user_id, 'username': username_leaving}, room=room_code)
    
    if request.sid in users_by_socket_id:
        del users_by_socket_id[request.sid]

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

if __name__ == '__main__':
    # Use Gunicorn with eventlet/gevent for production deployment
    # For local development, this simple run command is fine.
    # When deployed in Codespaces, it will be accessible via port forwarding.
    print("Starting Flask-SocketIO server on port 5000...")
    socketio.run(app, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True) # allow_unsafe_werkzeug for dev only
