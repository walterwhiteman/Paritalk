import { useState, useEffect, useRef } from 'react';
import { ref, push, set, onValue, off, serverTimestamp, onDisconnect } from 'firebase/database';
import { database } from '../config/firebase';
import { Message, User } from '../types';

export const useFirebaseChat = (roomCode: string, username: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [isConnected, setIsConnected] = useState(false);
  const userIdRef = useRef<string>(`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const userId = userIdRef.current;
    const roomRef = ref(database, `rooms/${roomCode}`);
    const messagesRef = ref(database, `rooms/${roomCode}/messages`);
    const usersRef = ref(database, `rooms/${roomCode}/users`);
    const userRef = ref(database, `rooms/${roomCode}/users/${userId}`);

    // Set user as online
    const userInfo: User = {
      id: userId,
      username,
      isOnline: true,
      lastSeen: Date.now(),
      isTyping: false
    };

    set(userRef, userInfo);
    setIsConnected(true);

    // Set user as offline when disconnecting
    onDisconnect(userRef).set({
      ...userInfo,
      isOnline: false,
      lastSeen: Date.now()
    });

    // Listen to messages
    const handleMessages = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const messagesList = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        }));
        messagesList.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messagesList);
      } else {
        setMessages([]);
      }
    };

    // Listen to users
    const handleUsers = (snapshot: any) => {
      const data = snapshot.val();
      setUsers(data || {});
    };

    onValue(messagesRef, handleMessages);
    onValue(usersRef, handleUsers);

    return () => {
      off(messagesRef, 'value', handleMessages);
      off(usersRef, 'value', handleUsers);
      set(userRef, {
        ...userInfo,
        isOnline: false,
        lastSeen: Date.now()
      });
    };
  }, [roomCode, username]);

  // Mark messages as delivered when partner comes online
  useEffect(() => {
    const userId = userIdRef.current;
    const currentUser = users[userId];
    const partnerUser = Object.values(users).find(user => user.id !== userId);
    
    if (currentUser && partnerUser && partnerUser.isOnline) {
      // Mark all undelivered messages from this user as delivered
      messages.forEach(async (message) => {
        if (message.sender === username && !message.isDelivered) {
          const messageRef = ref(database, `rooms/${roomCode}/messages/${message.id}`);
          await set(messageRef, {
            ...message,
            isDelivered: true
          });
        }
      });
    }
  }, [users, messages, roomCode, username]);

  const sendMessage = async (text: string, type: 'text' | 'image' | 'file' = 'text', fileUrl?: string, fileName?: string) => {
    const messagesRef = ref(database, `rooms/${roomCode}/messages`);
    const userId = userIdRef.current;
    const partnerUser = Object.values(users).find(user => user.id !== userId);
    
    const newMessage: any = {
      text,
      sender: username,
      timestamp: Date.now(),
      type,
      isDelivered: partnerUser?.isOnline || false, // Delivered immediately if partner is online
      isRead: false
    };

    // Only include fileUrl and fileName if they are defined
    if (fileUrl !== undefined) {
      newMessage.fileUrl = fileUrl;
    }
    if (fileName !== undefined) {
      newMessage.fileName = fileName;
    }

    await push(messagesRef, newMessage);
  };

  const setTyping = async (isTyping: boolean) => {
    const userId = userIdRef.current;
    const userRef = ref(database, `rooms/${roomCode}/users/${userId}`);
    
    const currentUser = users[userId];
    if (currentUser) {
      await set(userRef, {
        ...currentUser,
        isTyping
      });
    }
  };

  const addReaction = async (messageId: string, reaction: string) => {
    const userId = userIdRef.current;
    const reactionRef = ref(database, `rooms/${roomCode}/messages/${messageId}/reactions/${userId}`);
    await set(reactionRef, reaction);
  };

  const getPartnerTypingStatus = () => {
    const userId = userIdRef.current;
    const otherUsers = Object.values(users).filter(user => user.id !== userId);
    return otherUsers.find(user => user.isTyping);
  };

  const getPartnerOnlineStatus = () => {
    const userId = userIdRef.current;
    const otherUsers = Object.values(users).filter(user => user.id !== userId);
    return otherUsers.some(user => user.isOnline);
  };

  return {
    messages,
    users,
    isConnected,
    sendMessage,
    setTyping,
    addReaction,
    getPartnerTypingStatus,
    getPartnerOnlineStatus
  };
};
