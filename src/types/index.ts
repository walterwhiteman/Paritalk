export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  type: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
  reactions?: { [userId: string]: string };
}

export interface User {
  id: string;
  username: string;
  isOnline: boolean;
  lastSeen: number;
  isTyping: boolean;
}

export interface Room {
  id: string;
  users: { [userId: string]: User };
  messages: { [messageId: string]: Message };
}