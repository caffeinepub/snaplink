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

const Story = IDL.Record({
  id: IDL.Text,
  authorUsername: IDL.Text,
  authorDisplayName: IDL.Text,
  blobId: IDL.Text,
  caption: IDL.Text,
  timestamp: IDL.Int,
  expiresAt: IDL.Int,
});

const Reaction = IDL.Record({
  username: IDL.Text,
  emoji: IDL.Text,
  timestamp: IDL.Int,
});

const GroupInfo = IDL.Record({
  id: IDL.Text,
  name: IDL.Text,
  createdBy: IDL.Text,
  members: IDL.Vec(IDL.Text),
  createdAt: IDL.Int,
});

const GroupMessage = IDL.Record({
  id: IDL.Text,
  groupId: IDL.Text,
  senderUsername: IDL.Text,
  content: IDL.Text,
  timestamp: IDL.Int,
  isSnap: IDL.Bool,
  snapBlobId: IDL.Opt(IDL.Text),
});

// All methods from main.mo — exact signatures
const serviceDefinition = {
  // Auth
  register:         IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
  login:            IDL.Func([IDL.Text, IDL.Text],            [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
  loginWithII:      IDL.Func([],                             [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
  registerWithII:   IDL.Func([IDL.Text, IDL.Text],            [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
  getProfile:       IDL.Func([IDL.Text],                     [IDL.Opt(UserProfile)],                             ['query']),
  updateProfile:    IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })],    []),
  searchUsers:      IDL.Func([IDL.Text],                     [IDL.Vec(UserProfile)],                             ['query']),
  getAllUsers:       IDL.Func([],                             [IDL.Vec(UserProfile)],                             ['query']),
  // Connections
  sendConnectionRequest: IDL.Func([IDL.Text, IDL.Text],             [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  respondToRequest:      IDL.Func([IDL.Text, IDL.Text, IDL.Bool],   [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  getPendingRequests:    IDL.Func([IDL.Text],                        [IDL.Vec(ConnectionRequest)],                   []),
  getSentRequests:       IDL.Func([IDL.Text],                        [IDL.Vec(ConnectionRequest)],                   []),
  getFriends:            IDL.Func([IDL.Text],                        [IDL.Vec(UserProfile)],                         []),
  // Messaging
  sendMessage:      IDL.Func([IDL.Text, IDL.Text, IDL.Text],                    [IDL.Variant({ ok: Message, err: IDL.Text })], []),
  sendSnap:         IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Bool, IDL.Bool],[IDL.Variant({ ok: Message, err: IDL.Text })], []),
  getMessages:      IDL.Func([IDL.Text, IDL.Text, IDL.Int],          [IDL.Vec(Message)],                           []),
  markMessageRead:  IDL.Func([IDL.Text, IDL.Text],                    [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  viewSnap:         IDL.Func([IDL.Text, IDL.Text],                    [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  getUnreadCount:         IDL.Func([IDL.Text], [IDL.Nat], []),
  getPendingRequestCount: IDL.Func([IDL.Text], [IDL.Nat], []),
  getConversations:       IDL.Func([IDL.Text], [IDL.Vec(ConversationEntry)], []),
  // Stories
  postStory:        IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  getFriendStories: IDL.Func([IDL.Text],                     [IDL.Vec(Story)],                                 []),
  // Reactions
  addReaction:      IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  getReactions:     IDL.Func([IDL.Text],                     [IDL.Vec(Reaction)],                              ['query']),
  // Groups
  createGroup:      IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Text)], [IDL.Variant({ ok: GroupInfo, err: IDL.Text })], []),
  getGroups:        IDL.Func([IDL.Text],                               [IDL.Vec(GroupInfo)],                            []),
  sendGroupMessage: IDL.Func([IDL.Text, IDL.Text, IDL.Text],           [IDL.Variant({ ok: GroupMessage, err: IDL.Text })], []),
  getGroupMessages: IDL.Func([IDL.Text, IDL.Text, IDL.Int],            [IDL.Vec(GroupMessage)],                          []),
  // Streaks
  getStreak:        IDL.Func([IDL.Text, IDL.Text], [IDL.Nat], ['query']),
  // Snap Score
  getSnapScore:     IDL.Func([IDL.Text], [IDL.Nat], ['query']),
  // Ghost Mode
  setGhostMode:     IDL.Func([IDL.Text, IDL.Bool], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  isGhostMode:      IDL.Func([IDL.Text],            [IDL.Bool],                                      ['query']),
  // Read Receipts
  setReadReceiptsEnabled: IDL.Func([IDL.Text, IDL.Bool], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
  getReadReceiptsEnabled: IDL.Func([IDL.Text],            [IDL.Bool],                                      ['query']),
  // Daily Login
  recordDailyLogin: IDL.Func([IDL.Text], [IDL.Nat], []),
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
  const Story = IDL.Record({
    id: IDL.Text,
    authorUsername: IDL.Text,
    authorDisplayName: IDL.Text,
    blobId: IDL.Text,
    caption: IDL.Text,
    timestamp: IDL.Int,
    expiresAt: IDL.Int,
  });
  const Reaction = IDL.Record({
    username: IDL.Text,
    emoji: IDL.Text,
    timestamp: IDL.Int,
  });
  const GroupInfo = IDL.Record({
    id: IDL.Text,
    name: IDL.Text,
    createdBy: IDL.Text,
    members: IDL.Vec(IDL.Text),
    createdAt: IDL.Int,
  });
  const GroupMessage = IDL.Record({
    id: IDL.Text,
    groupId: IDL.Text,
    senderUsername: IDL.Text,
    content: IDL.Text,
    timestamp: IDL.Int,
    isSnap: IDL.Bool,
    snapBlobId: IDL.Opt(IDL.Text),
  });
  return IDL.Service({
    // Auth
    register:         IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
    login:            IDL.Func([IDL.Text, IDL.Text],            [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
    loginWithII:      IDL.Func([],                             [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
    registerWithII:   IDL.Func([IDL.Text, IDL.Text],            [IDL.Variant({ ok: UserProfile, err: IDL.Text })], []),
    getProfile:       IDL.Func([IDL.Text],                     [IDL.Opt(UserProfile)],                             ['query']),
    updateProfile:    IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })],    []),
    searchUsers:      IDL.Func([IDL.Text],                     [IDL.Vec(UserProfile)],                             ['query']),
    getAllUsers:       IDL.Func([],                             [IDL.Vec(UserProfile)],                             ['query']),
    // Connections
    sendConnectionRequest: IDL.Func([IDL.Text, IDL.Text],             [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    respondToRequest:      IDL.Func([IDL.Text, IDL.Text, IDL.Bool],   [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    getPendingRequests:    IDL.Func([IDL.Text],                        [IDL.Vec(ConnectionRequest)],                   []),
    getSentRequests:       IDL.Func([IDL.Text],                        [IDL.Vec(ConnectionRequest)],                   []),
    getFriends:            IDL.Func([IDL.Text],                        [IDL.Vec(UserProfile)],                         []),
    // Messaging
    sendMessage:      IDL.Func([IDL.Text, IDL.Text, IDL.Text],                    [IDL.Variant({ ok: Message, err: IDL.Text })], []),
    sendSnap:         IDL.Func([IDL.Text, IDL.Text, IDL.Text, IDL.Bool, IDL.Bool],[IDL.Variant({ ok: Message, err: IDL.Text })], []),
    getMessages:      IDL.Func([IDL.Text, IDL.Text, IDL.Int],          [IDL.Vec(Message)],                           []),
    markMessageRead:  IDL.Func([IDL.Text, IDL.Text],                    [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    viewSnap:         IDL.Func([IDL.Text, IDL.Text],                    [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    getUnreadCount:         IDL.Func([IDL.Text], [IDL.Nat], []),
    getPendingRequestCount: IDL.Func([IDL.Text], [IDL.Nat], []),
    getConversations:       IDL.Func([IDL.Text], [IDL.Vec(ConversationEntry)], []),
    // Stories
    postStory:        IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    getFriendStories: IDL.Func([IDL.Text],                     [IDL.Vec(Story)],                                 []),
    // Reactions
    addReaction:      IDL.Func([IDL.Text, IDL.Text, IDL.Text], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    getReactions:     IDL.Func([IDL.Text],                     [IDL.Vec(Reaction)],                              ['query']),
    // Groups
    createGroup:      IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Text)], [IDL.Variant({ ok: GroupInfo, err: IDL.Text })], []),
    getGroups:        IDL.Func([IDL.Text],                               [IDL.Vec(GroupInfo)],                            []),
    sendGroupMessage: IDL.Func([IDL.Text, IDL.Text, IDL.Text],           [IDL.Variant({ ok: GroupMessage, err: IDL.Text })], []),
    getGroupMessages: IDL.Func([IDL.Text, IDL.Text, IDL.Int],            [IDL.Vec(GroupMessage)],                          []),
    // Streaks
    getStreak:        IDL.Func([IDL.Text, IDL.Text], [IDL.Nat], ['query']),
    // Snap Score
    getSnapScore:     IDL.Func([IDL.Text], [IDL.Nat], ['query']),
    // Ghost Mode
    setGhostMode:     IDL.Func([IDL.Text, IDL.Bool], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    isGhostMode:      IDL.Func([IDL.Text],            [IDL.Bool],                                      ['query']),
    // Read Receipts
    setReadReceiptsEnabled: IDL.Func([IDL.Text, IDL.Bool], [IDL.Variant({ ok: IDL.Null, err: IDL.Text })], []),
    getReadReceiptsEnabled: IDL.Func([IDL.Text],            [IDL.Bool],                                      ['query']),
    // Daily Login
    recordDailyLogin: IDL.Func([IDL.Text], [IDL.Nat], []),
    // Admin
    clearAllData:     IDL.Func([], [IDL.Variant({ ok: IDL.Null })], []),
  });
};

export const init = ({ IDL }) => { return []; };
