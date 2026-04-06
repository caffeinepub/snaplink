import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Text "mo:core/Text";

module {
  type UserProfile = {
    username : Text;
    displayName : Text;
    passwordHash : Text;
    principalText : Text;
    bio : Text;
    createdAt : Int;
  };

  type ConnectionRequest = {
    id : Text;
    fromUser : Text;
    toUser : Text;
    status : { #pending; #accepted; #declined };
    createdAt : Int;
  };

  type Message = {
    id : Text;
    senderId : Text;
    receiverId : Text;
    content : Text;
    timestamp : Int;
    isRead : Bool;
    isSnap : Bool;
    snapBlobId : ?Text;
    isEphemeral : Bool;
    snapViewed : Bool;
  };

  type Story = {
    id : Text;
    authorUsername : Text;
    authorDisplayName : Text;
    blobId : Text;
    caption : Text;
    timestamp : Int;
    expiresAt : Int;
  };

  type Reaction = {
    username : Text;
    emoji : Text;
    timestamp : Int;
  };

  type GroupInfo = {
    id : Text;
    name : Text;
    createdBy : Text;
    members : [Text];
    createdAt : Int;
  };

  type GroupMessage = {
    id : Text;
    groupId : Text;
    senderUsername : Text;
    content : Text;
    timestamp : Int;
    isSnap : Bool;
    snapBlobId : ?Text;
  };

  type StreakEntry = {
    user1 : Text;
    user2 : Text;
    count : Nat;
    lastSnapAt : Int;
  };

  // CapsuleMessage type for new state
  type CapsuleMessage = {
    id : Text;
    senderId : Text;
    receiverId : Text;
    blobId : Text;
    unlockAt : Int;
    isUnlocked : Bool;
    timestamp : Int;
  };

  type OldActor = {
    usersByUsername : Map.Map<Text, UserProfile>;
    usersByPrincipal : Map.Map<Text, Text>;
    connectionRequests : Map.Map<Text, ConnectionRequest>;
    messages : Map.Map<Text, Message>;
    messageCounter : Nat;
    requestCounter : Nat;
    stories : Map.Map<Text, Story>;
    reactions : Map.Map<Text, [Reaction]>;
    groups : Map.Map<Text, GroupInfo>;
    groupMessages : Map.Map<Text, GroupMessage>;
    streaks : Map.Map<Text, StreakEntry>;
    snapScores : Map.Map<Text, Nat>;
    storyCounter : Nat;
    groupCounter : Nat;
    groupMsgCounter : Nat;
    ghostMode : Map.Map<Text, Bool>;
    readReceiptsEnabled : Map.Map<Text, Bool>;
    lastLoginDay : Map.Map<Text, Int>;
  };

  type NewActor = {
    usersByUsername : Map.Map<Text, UserProfile>;
    usersByPrincipal : Map.Map<Text, Text>;
    connectionRequests : Map.Map<Text, ConnectionRequest>;
    messages : Map.Map<Text, Message>;
    messageCounter : Nat;
    requestCounter : Nat;
    stories : Map.Map<Text, Story>;
    reactions : Map.Map<Text, [Reaction]>;
    groups : Map.Map<Text, GroupInfo>;
    groupMessages : Map.Map<Text, GroupMessage>;
    streaks : Map.Map<Text, StreakEntry>;
    snapScores : Map.Map<Text, Nat>;
    storyCounter : Nat;
    groupCounter : Nat;
    groupMsgCounter : Nat;
    ghostMode : Map.Map<Text, Bool>;
    readReceiptsEnabled : Map.Map<Text, Bool>;
    lastLoginDay : Map.Map<Text, Int>;
    voiceMessagesSent : Map.Map<Text, Nat>;
    locationSharesSent : Map.Map<Text, Nat>;
    storiesPostedCount : Map.Map<Text, Nat>;
    groupsCreatedCount : Map.Map<Text, Nat>;
    capsuleMessages : Map.Map<Text, CapsuleMessage>;
    capsuleCounter : Nat;
  };

  public func run(old : OldActor) : NewActor {
    {
      usersByUsername = old.usersByUsername;
      usersByPrincipal = old.usersByPrincipal;
      connectionRequests = old.connectionRequests;
      messages = old.messages;
      messageCounter = old.messageCounter;
      requestCounter = old.requestCounter;
      stories = old.stories;
      reactions = old.reactions;
      groups = old.groups;
      groupMessages = old.groupMessages;
      streaks = old.streaks;
      snapScores = old.snapScores;
      storyCounter = old.storyCounter;
      groupCounter = old.groupCounter;
      groupMsgCounter = old.groupMsgCounter;
      ghostMode = old.ghostMode;
      readReceiptsEnabled = old.readReceiptsEnabled;
      lastLoginDay = old.lastLoginDay;
      voiceMessagesSent = Map.empty<Text, Nat>();
      locationSharesSent = Map.empty<Text, Nat>();
      storiesPostedCount = Map.empty<Text, Nat>();
      groupsCreatedCount = Map.empty<Text, Nat>();
      capsuleMessages = Map.empty<Text, CapsuleMessage>();
      capsuleCounter = 0;
    };
  };
};
