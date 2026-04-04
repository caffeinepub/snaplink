/* eslint-disable */
// @ts-nocheck

import { IDL } from '@icp-sdk/core/candid';

const UserProfile = IDL.Record({
  username: IDL.Text,
  displayName: IDL.Text,
  passwordHash: IDL.Text,
  principalText: IDL.Text,
  bio: IDL.Text,
  createdAt: IDL.Int,
});

const ConnectionStatus = IDL.Variant({
  pending: IDL.Null,
  accepted: IDL.Null,
  declined: IDL.Null,
});

const ConnectionRequest = IDL.Record({
  id: IDL.Text,
  fromUser: IDL.Text,
  toUser: IDL.Text,
  status: ConnectionStatus,
  createdAt: IDL.Int,
});

const Message = IDL.Record({
  id: IDL.Text,
  senderId: IDL.Text,
  receiverId: IDL.Text,
  content: IDL.Text,
  timestamp: IDL.Int,
  isRead: IDL.Bool,
  isSnap: IDL.Bool,
  snapBlobId: IDL.Opt(IDL.Text),
  isEphemeral: IDL.Bool,
  snapViewed: IDL.Bool,
});

const ConversationEntry = IDL.Record({
  username: IDL.Text,
  displayName: IDL.Text,
  lastMessageContent: IDL.Text,
  lastMessageTimestamp: IDL.Int,
  unreadCount: IDL.Nat,
});

// Exact method signatures matching main.mo
const serviceDefinition = {
  // Auth (no callerUsername needed — use caller principal or open)
  register:         IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
  login:            IDL.Func([IDL.Text, IDL.Text],            [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
  loginWithII:      IDL.Func([],                             [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
  registerWithII:   IDL.Func([IDL.Text, IDL.Text],            [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
  getProfile:       IDL.Func([IDL.Text],                     [IDL.Opt(UserProfile)],                             ['query']),
  // callerUsername, displayName, bio
  updateProfile:    IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })],    []),
  searchUsers:      IDL.Func([IDL.Text],                     [IDL.Vec(UserProfile)],                             ['query']),
  getAllUsers:       IDL.Func([],                             [IDL.Vec(UserProfile)],                             ['query']),
  // Connections — (callerUsername, toUsername)
  sendConnectionRequest: IDL.Func([IDL.Text, IDL.Text],             [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  // (callerUsername, requestId, accept)
  respondToRequest:      IDL.Func([IDL.Text, IDL.Text, IDL.Bool],   [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  getPendingRequests:    IDL.Func([IDL.Text],                        [IDL.Vec(ConnectionRequest)],                   []),
  getSentRequests:       IDL.Func([IDL.Text],                        [IDL.Vec(ConnectionRequest)],                   []),
  getFriends:            IDL.Func([IDL.Text],                        [IDL.Vec(UserProfile)],                         []),
  // Messaging — (callerUsername, toUsername, content)
  sendMessage:      IDL.Func([IDL.Text, IDL.Text, IDL.Text],                    [IDL.Variant({ ok: Message, err: IDL.Text })], []),
  // (callerUsername, toUsername, blobId, isEphemeral, saveToChat)
  sendSnap:         IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Bool, IDL.Bool],[IDL.Variant({ ok: Message, err: IDL.Text })], []),
  // (callerUsername, withUsername, since)
  getMessages:      IDL.Func([IDL.Text, IDL.Text, IDL.Int],          [IDL.Vec(Message)],                           []),
  // (callerUsername, messageId)
  markMessageRead:  IDL.Func([IDL.Text, IDL.Text],                    [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  viewSnap:         IDL.Func([IDL.Text, IDL.Text],                    [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  getUnreadCount:         IDL.Func([IDL.Text], [IDL.Nat], []),
  getPendingRequestCount: IDL.Func([IDL.Text], [IDL.Nat], []),
  getConversations:       IDL.Func([IDL.Text], [IDL.Vec(ConversationEntry)], []),
  // Admin
  clearAllData:     IDL.Func([], [IDL.Variant({ ok: IDL.Null })], []),
};

export const idlService = IDL.Service(serviceDefinition);
export const idlInitArgs = [];

export const idlFactory = ({ IDL }) => {
  const UserProfile = IDL.Record({
    username: IDL.Text,
    displayName: IDL.Text,
    passwordHash: IDL.Text,
    principalText: IDL.Text,
    bio: IDL.Text,
    createdAt: IDL.Int,
  });
  const ConnectionStatus = IDL.Variant({
    pending: IDL.Null,
    accepted: IDL.Null,
    declined: IDL.Null,
  });
  const ConnectionRequest = IDL.Record({
    id: IDL.Text,
    fromUser: IDL.Text,
    toUser: IDL.Text,
    status: ConnectionStatus,
    createdAt: IDL.Int,
  });
  const Message = IDL.Record({
    id: IDL.Text,
    senderId: IDL.Text,
    receiverId: IDL.Text,
    content: IDL.Text,
    timestamp: IDL.Int,
    isRead: IDL.Bool,
    isSnap: IDL.Bool,
    snapBlobId: IDL.Opt(IDL.Text),
    isEphemeral: IDL.Bool,
    snapViewed: IDL.Bool,
  });
  const ConversationEntry = IDL.Record({
    username: IDL.Text,
    displayName: IDL.Text,
    lastMessageContent: IDL.Text,
    lastMessageTimestamp: IDL.Int,
    unreadCount: IDL.Nat,
  });
  return IDL.Service({
    register:         IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
    login:            IDL.Func([IDL.Text, IDL.Text],            [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
    loginWithII:      IDL.Func([],                             [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
    registerWithII:   IDL.Func([IDL.Text, IDL.Text],            [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
    getProfile:       IDL.Func([IDL.Text],                     [IDL.Opt(UserProfile)],                             ['query']),
    updateProfile:    IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })],    []),
    searchUsers:      IDL.Func([IDL.Text],                     [IDL.Vec(UserProfile)],                             ['query']),
    getAllUsers:       IDL.Func([],                             [IDL.Vec(UserProfile)],                             ['query']),
    sendConnectionRequest: IDL.Func([IDL.Text, IDL.Text],             [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    respondToRequest:      IDL.Func([IDL.Text, IDL.Text, IDL.Bool],   [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    getPendingRequests:    IDL.Func([IDL.Text],                        [IDL.Vec(ConnectionRequest)],                   []),
    getSentRequests:       IDL.Func([IDL.Text],                        [IDL.Vec(ConnectionRequest)],                   []),
    getFriends:            IDL.Func([IDL.Text],                        [IDL.Vec(UserProfile)],                         []),
    sendMessage:      IDL.Func([IDL.Text, IDL.Text, IDL.Text],                    [IDL.Variant({ ok: Message, err: IDL.Text })], []),
    sendSnap:         IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Bool, IDL.Bool],[IDL.Variant({ ok: Message, err: IDL.Text })], []),
    getMessages:      IDL.Func([IDL.Text, IDL.Text, IDL.Int],          [IDL.Vec(Message)],                           []),
    markMessageRead:  IDL.Func([IDL.Text, IDL.Text],                    [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    viewSnap:         IDL.Func([IDL.Text, IDL.Text],                    [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    getUnreadCount:         IDL.Func([IDL.Text], [IDL.Nat], []),
    getPendingRequestCount: IDL.Func([IDL.Text], [IDL.Nat], []),
    getConversations:       IDL.Func([IDL.Text], [IDL.Vec(ConversationEntry)], []),
    clearAllData:     IDL.Func([], [IDL.Variant({ ok: IDL.Null })], []),
  });
};

export const init = ({ IDL }) => { return []; };
