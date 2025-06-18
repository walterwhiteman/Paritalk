// src/hooks/useFirebaseChat.ts
import { useState, useEffect, useRef } from 'react';
import { ref, push, set, onValue, off, serverTimestamp, onDisconnect } from 'firebase/database';
import { database } from '../config/firebase';
import { Message, User } from '../types'; // Assuming these interfaces are correctly defined in ../types

export const useFirebaseChat = (roomCode: string, username: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<{ [key: string]: User }>({});
  const [isConnected, setIsConnected] = useState(false);
  const userIdRef = useRef<string>(`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const userId = userIdRef.current;
    const roomRef = ref(database, `rooms/${roomCode}`); // Not directly used in listeners below, but kept for context
    const messagesRef = ref(database, `rooms/${roomCode}/messages`);
    const usersRef = ref(database, `rooms/${roomCode}/users`);
    const userRef = ref(database, `rooms/${roomCode}/users/${userId}`);

    // Set user as online
    const userInfo: User = {
      id: userId,
      username,
      isOnline: true,
      lastSeen: Date.now(), // Store as number
      isTyping: false
    };

    set(userRef, userInfo);
    setIsConnected(true);

    // Set user as offline when disconnecting (best effort)
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
          ...value,
          // FIX APPLIED HERE: Convert numeric timestamp from Realtime DB to Date object
          timestamp: new Date(value.timestamp)
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
      // Ensure lastSeen is converted if used as Date object elsewhere, or handle as number
      const parsedUsers: { [key: string]: User } = {};
      if (data) {
        for (const id in data) {
          if (data.hasOwnProperty(id)) {
            parsedUsers[id] = {
              ...data[id],
              // lastSeen: new Date(data[id].lastSeen) // Convert if lastSeen is used as Date
            };
          }
        }
      }
      setUsers(parsedUsers || {});
    };

    onValue(messagesRef, handleMessages);
    onValue(usersRef, handleUsers);

    return () => {
      off(messagesRef, 'value', handleMessages);
      off(usersRef, 'value', handleUsers);
      // Explicitly set user offline on component unmount
      set(userRef, {
        ...userInfo,
        isOnline: false,
        lastSeen: Date.now()
      });
    };
  }, [roomCode, username]);

  const sendMessage = async (text: string, type: 'text' | 'image' | 'file' = 'text', fileUrl?: string, fileName?: string) => {
    const messagesRef = ref(database, `rooms/${roomCode}/messages`);
    const newMessage: any = {
      text,
      sender: username,
      timestamp: Date.now(), // Stored as number
      type
    };

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

  // REMOVED: addReaction function, as per your request to remove emoji reactions
  // const addReaction = async (messageId: string, reaction: string) => {
  //   const userId = userIdRef.current;
  //   const reactionRef = ref(database, `rooms/${roomCode}/messages/${messageId}/reactions/${userId}`);
  //   await set(reactionRef, reaction);
  // };

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
    // REMOVED: addReaction from return
    getPartnerTypingStatus,
    getPartnerOnlineStatus
  };
};