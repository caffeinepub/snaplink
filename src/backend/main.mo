import Time "mo:core/Time";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Iter "mo:core/Iter";
import Prim "mo:prim";
import Storage "blob-storage/Storage";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";

import MixinStorage "blob-storage/Mixin";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";


actor {
  // ========== MIXINS ==========
  include MixinStorage();
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // ========== TYPES ==========

  type UserProfile = {
    username : Text;
    displayName : Text;
    passwordHash : Text;
    principalText : Text;
    bio : Text;
    createdAt : Int;
  };

  type ConnectionStatus = { #pending; #accepted; #declined };

  type ConnectionRequest = {
    id : Text;
    fromUser : Text;
    toUser : Text;
    status : ConnectionStatus;
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

  type LeaderboardEntry = {
    username : Text;
    displayName : Text;
    snapScore : Nat;
    rank : Nat;
  };

  type Badge = {
    id : Text;
    name : Text;
    description : Text;
    unlocked : Bool;
  };

  type CapsuleMessage = {
    id : Text;
    senderId : Text;
    receiverId : Text;
    blobId : Text;
    unlockAt : Int;
    isUnlocked : Bool;
    timestamp : Int;
  };

  // ========== STABLE STATE ==========

  var stableUsersByUsername : [(Text, UserProfile)] = [];
  var stableUsersByPrincipal : [(Text, Text)] = [];
  var stableConnectionRequests : [(Text, ConnectionRequest)] = [];
  var stableMessages : [(Text, Message)] = [];
  var stableMessageCounter : Nat = 0;
  var stableRequestCounter : Nat = 0;
  var stableStories : [(Text, Story)] = [];
  var stableReactions : [(Text, [Reaction])] = [];
  var stableGroups : [(Text, GroupInfo)] = [];
  var stableGroupMessages : [(Text, GroupMessage)] = [];
  var stableStreaks : [(Text, StreakEntry)] = [];
  var stableSnapScores : [(Text, Nat)] = [];
  var stableStoryCounter : Nat = 0;
  var stableGroupCounter : Nat = 0;
  var stableGroupMsgCounter : Nat = 0;
  var stableGhostMode : [(Text, Bool)] = [];
  var stableReadReceiptsEnabled : [(Text, Bool)] = [];
  var stableLastLoginDay : [(Text, Int)] = [];
  var stableVoiceMessagesSent : [(Text, Nat)] = [];
  var stableLocationSharesSent : [(Text, Nat)] = [];
  var stableStoriesPostedCount : [(Text, Nat)] = [];
  var stableGroupsCreatedCount : [(Text, Nat)] = [];
  var stableCapsuleMessages : [(Text, CapsuleMessage)] = [];
  var stableCapsuleCounter : Nat = 0;

  // ========== STATE ==========

  var usersByUsername : Map.Map<Text, UserProfile> = Map.fromIter(stableUsersByUsername.vals());
  var usersByPrincipal : Map.Map<Text, Text> = Map.fromIter(stableUsersByPrincipal.vals());
  var connectionRequests : Map.Map<Text, ConnectionRequest> = Map.fromIter(stableConnectionRequests.vals());
  var messages : Map.Map<Text, Message> = Map.fromIter(stableMessages.vals());
  var messageCounter : Nat = stableMessageCounter;
  var requestCounter : Nat = stableRequestCounter;
  var stories : Map.Map<Text, Story> = Map.fromIter(stableStories.vals());
  var reactions : Map.Map<Text, [Reaction]> = Map.fromIter(stableReactions.vals());
  var groups : Map.Map<Text, GroupInfo> = Map.fromIter(stableGroups.vals());
  var groupMessages : Map.Map<Text, GroupMessage> = Map.fromIter(stableGroupMessages.vals());
  var streaks : Map.Map<Text, StreakEntry> = Map.fromIter(stableStreaks.vals());
  var snapScores : Map.Map<Text, Nat> = Map.fromIter(stableSnapScores.vals());
  var storyCounter : Nat = stableStoryCounter;
  var groupCounter : Nat = stableGroupCounter;
  var groupMsgCounter : Nat = stableGroupMsgCounter;
  var ghostMode : Map.Map<Text, Bool> = Map.fromIter(stableGhostMode.vals());
  var readReceiptsEnabled : Map.Map<Text, Bool> = Map.fromIter(stableReadReceiptsEnabled.vals());
  var lastLoginDay : Map.Map<Text, Int> = Map.fromIter(stableLastLoginDay.vals());
  var voiceMessagesSent : Map.Map<Text, Nat> = Map.fromIter(stableVoiceMessagesSent.vals());
  var locationSharesSent : Map.Map<Text, Nat> = Map.fromIter(stableLocationSharesSent.vals());
  var storiesPostedCount : Map.Map<Text, Nat> = Map.fromIter(stableStoriesPostedCount.vals());
  var groupsCreatedCount : Map.Map<Text, Nat> = Map.fromIter(stableGroupsCreatedCount.vals());
  var capsuleMessages : Map.Map<Text, CapsuleMessage> = Map.fromIter(stableCapsuleMessages.vals());
  var capsuleCounter : Nat = stableCapsuleCounter;

  // ========== SYSTEM HOOKS ==========

  system func preupgrade() {
    stableUsersByUsername := [];
    for ((k, v) in usersByUsername.entries()) {
      stableUsersByUsername := stableUsersByUsername.concat([(k, v)]);
    };
    stableUsersByPrincipal := [];
    for ((k, v) in usersByPrincipal.entries()) {
      stableUsersByPrincipal := stableUsersByPrincipal.concat([(k, v)]);
    };
    stableConnectionRequests := [];
    for ((k, v) in connectionRequests.entries()) {
      stableConnectionRequests := stableConnectionRequests.concat([(k, v)]);
    };
    stableMessages := [];
    for ((k, v) in messages.entries()) {
      stableMessages := stableMessages.concat([(k, v)]);
    };
    stableMessageCounter := messageCounter;
    stableRequestCounter := requestCounter;
    stableStories := [];
    for ((k, v) in stories.entries()) {
      stableStories := stableStories.concat([(k, v)]);
    };
    stableReactions := [];
    for ((k, v) in reactions.entries()) {
      stableReactions := stableReactions.concat([(k, v)]);
    };
    stableGroups := [];
    for ((k, v) in groups.entries()) {
      stableGroups := stableGroups.concat([(k, v)]);
    };
    stableGroupMessages := [];
    for ((k, v) in groupMessages.entries()) {
      stableGroupMessages := stableGroupMessages.concat([(k, v)]);
    };
    stableStreaks := [];
    for ((k, v) in streaks.entries()) {
      stableStreaks := stableStreaks.concat([(k, v)]);
    };
    stableSnapScores := [];
    for ((k, v) in snapScores.entries()) {
      stableSnapScores := stableSnapScores.concat([(k, v)]);
    };
    stableStoryCounter := storyCounter;
    stableGroupCounter := groupCounter;
    stableGroupMsgCounter := groupMsgCounter;
    stableGhostMode := [];
    for ((k, v) in ghostMode.entries()) {
      stableGhostMode := stableGhostMode.concat([(k, v)]);
    };
    stableReadReceiptsEnabled := [];
    for ((k, v) in readReceiptsEnabled.entries()) {
      stableReadReceiptsEnabled := stableReadReceiptsEnabled.concat([(k, v)]);
    };
    stableLastLoginDay := [];
    for ((k, v) in lastLoginDay.entries()) {
      stableLastLoginDay := stableLastLoginDay.concat([(k, v)]);
    };
    stableVoiceMessagesSent := [];
    for ((k, v) in voiceMessagesSent.entries()) {
      stableVoiceMessagesSent := stableVoiceMessagesSent.concat([(k, v)]);
    };
    stableLocationSharesSent := [];
    for ((k, v) in locationSharesSent.entries()) {
      stableLocationSharesSent := stableLocationSharesSent.concat([(k, v)]);
    };
    stableStoriesPostedCount := [];
    for ((k, v) in storiesPostedCount.entries()) {
      stableStoriesPostedCount := stableStoriesPostedCount.concat([(k, v)]);
    };
    stableGroupsCreatedCount := [];
    for ((k, v) in groupsCreatedCount.entries()) {
      stableGroupsCreatedCount := stableGroupsCreatedCount.concat([(k, v)]);
    };
    stableCapsuleMessages := [];
    for ((k, v) in capsuleMessages.entries()) {
      stableCapsuleMessages := stableCapsuleMessages.concat([(k, v)]);
    };
    stableCapsuleCounter := capsuleCounter;
  };

  system func postupgrade() {
    usersByUsername := Map.fromIter(stableUsersByUsername.vals());
    usersByPrincipal := Map.fromIter(stableUsersByPrincipal.vals());
    connectionRequests := Map.fromIter(stableConnectionRequests.vals());
    messages := Map.fromIter(stableMessages.vals());
    messageCounter := stableMessageCounter;
    requestCounter := stableRequestCounter;
    stories := Map.fromIter(stableStories.vals());
    reactions := Map.fromIter(stableReactions.vals());
    groups := Map.fromIter(stableGroups.vals());
    groupMessages := Map.fromIter(stableGroupMessages.vals());
    streaks := Map.fromIter(stableStreaks.vals());
    snapScores := Map.fromIter(stableSnapScores.vals());
    storyCounter := stableStoryCounter;
    groupCounter := stableGroupCounter;
    groupMsgCounter := stableGroupMsgCounter;
    ghostMode := Map.fromIter(stableGhostMode.vals());
    readReceiptsEnabled := Map.fromIter(stableReadReceiptsEnabled.vals());
    lastLoginDay := Map.fromIter(stableLastLoginDay.vals());
    voiceMessagesSent := Map.fromIter(stableVoiceMessagesSent.vals());
    locationSharesSent := Map.fromIter(stableLocationSharesSent.vals());
    storiesPostedCount := Map.fromIter(stableStoriesPostedCount.vals());
    groupsCreatedCount := Map.fromIter(stableGroupsCreatedCount.vals());
    capsuleMessages := Map.fromIter(stableCapsuleMessages.vals());
    capsuleCounter := stableCapsuleCounter;
  };

  // ========== HELPERS ==========

  func generateId(prefix : Text, counter : Nat) : Text {
    prefix # "_" # counter.toText();
  };

  func simpleHash(t : Text) : Text {
    var h : Nat = 5381;
    for (c in t.chars()) {
      h := (h * 33 + c.toNat32().toNat()) % 1_000_000_007;
    };
    h.toText();
  };

  func areFriends(user1 : Text, user2 : Text) : Bool {
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#accepted) {
          if ((req.fromUser == user1 and req.toUser == user2) or
              (req.fromUser == user2 and req.toUser == user1)) {
            return true;
          };
        };
        case (_) {};
      };
    };
    false;
  };

  func getPrincipalUsername(p : Principal) : ?Text {
    usersByPrincipal.get(p.toText());
  };

  func resolveUsername(callerUsername : Text, caller : Principal) : ?Text {
    if (callerUsername.size() > 0) {
      switch (usersByUsername.get(callerUsername)) {
        case (?_) { ?callerUsername };
        case (null) { null };
      };
    } else {
      getPrincipalUsername(caller);
    };
  };

  func hasPendingRequest(fromUser : Text, toUser : Text) : ?ConnectionRequest {
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#pending) {
          if (req.fromUser == fromUser and req.toUser == toUser) {
            return ?req;
          };
        };
        case (_) {};
      };
    };
    null;
  };

  func streakKey(u1 : Text, u2 : Text) : Text {
    if (u1 < u2) u1 # ":" # u2 else u2 # ":" # u1;
  };

  func utcDayFromNanos(nanos : Int) : Int {
    let secsPerDay : Int = 86_400;
    let nanosPerSec : Int = 1_000_000_000;
    nanos / (secsPerDay * nanosPerSec);
  };

  func getOrZero(m : Map.Map<Text, Nat>, key : Text) : Nat {
    switch (m.get(key)) {
      case (?v) v;
      case (null) 0;
    };
  };

  // ========== AUTH ==========

  public shared ({ caller }) func register(username : Text, password : Text, displayName : Text) : async { #ok : UserProfile; #err : Text } {
    if (username.size() < 3) return #err("Username must be at least 3 characters");
    if (password.size() < 6) return #err("Password must be at least 6 characters");
    switch (usersByUsername.get(username)) {
      case (?_) return #err("Username already taken");
      case (null) {};
    };
    let dn = if (displayName.size() == 0) username else displayName;
    let profile : UserProfile = {
      username;
      displayName = dn;
      passwordHash = simpleHash(password);
      principalText = caller.toText();
      bio = "";
      createdAt = Time.now();
    };
    usersByUsername.add(username, profile);
    usersByPrincipal.add(caller.toText(), username);
    AccessControl.assignRole(accessControlState, caller, caller, #user);
    #ok(profile);
  };

  public shared func login(username : Text, password : Text) : async { #ok : UserProfile; #err : Text } {
    let h = simpleHash(password);
    switch (usersByUsername.get(username)) {
      case (null) return #err("User not found");
      case (?profile) {
        if (profile.passwordHash != h) return #err("Invalid password");
        #ok(profile);
      };
    };
  };

  public shared ({ caller }) func loginWithII() : async { #ok : UserProfile; #err : Text } {
    switch (getPrincipalUsername(caller)) {
      case (null) return #err("No account linked to this identity");
      case (?username) {
        switch (usersByUsername.get(username)) {
          case (null) return #err("User not found");
          case (?profile) return #ok(profile);
        };
      };
    };
  };

  public shared ({ caller }) func registerWithII(username : Text, displayName : Text) : async { #ok : UserProfile; #err : Text } {
    if (username.size() < 3) return #err("Username must be at least 3 characters");
    switch (usersByUsername.get(username)) {
      case (?_) return #err("Username already taken");
      case (null) {};
    };
    let dn = if (displayName.size() == 0) username else displayName;
    let profile : UserProfile = {
      username;
      displayName = dn;
      passwordHash = "";
      principalText = caller.toText();
      bio = "";
      createdAt = Time.now();
    };
    usersByUsername.add(username, profile);
    usersByPrincipal.add(caller.toText(), username);
    AccessControl.assignRole(accessControlState, caller, caller, #user);
    #ok(profile);
  };

  public query func getProfile(username : Text) : async ?UserProfile {
    usersByUsername.get(username);
  };

  public shared ({ caller }) func updateProfile(callerUsername : Text, displayName : Text, bio : Text) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    switch (usersByUsername.get(username)) {
      case (null) return #err("User not found");
      case (?profile) {
        usersByUsername.add(username, { profile with displayName; bio });
        #ok;
      };
    };
  };

  public query func searchUsers(q : Text) : async [UserProfile] {
    var results : [UserProfile] = [];
    for ((_, profile) in usersByUsername.entries()) {
      if (profile.username.contains(#text q) or profile.displayName.contains(#text q)) {
        results := results.concat([profile]);
      };
    };
    results;
  };

  public query func getAllUsers() : async [UserProfile] {
    var results : [UserProfile] = [];
    for ((_, profile) in usersByUsername.entries()) {
      results := results.concat([profile]);
    };
    results;
  };

  // ========== CONNECTIONS ==========

  public shared ({ caller }) func sendConnectionRequest(callerUsername : Text, toUsername : Text) : async { #ok; #err : Text } {
    let fromUsername = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    if (fromUsername == toUsername) return #err("Cannot connect with yourself");
    switch (usersByUsername.get(toUsername)) {
      case (null) return #err("User not found");
      case (?_) {};
    };
    if (areFriends(fromUsername, toUsername)) return #err("Already friends");
    switch (hasPendingRequest(fromUsername, toUsername)) {
      case (?_) return #err("Request already sent");
      case (null) {};
    };
    switch (hasPendingRequest(toUsername, fromUsername)) {
      case (?reverseReq) {
        connectionRequests.add(reverseReq.id, { reverseReq with status = #accepted });
        requestCounter += 1;
        let reqId = generateId("req", requestCounter);
        let newReq : ConnectionRequest = {
          id = reqId;
          fromUser = fromUsername;
          toUser = toUsername;
          status = #accepted;
          createdAt = Time.now();
        };
        connectionRequests.add(reqId, newReq);
        return #ok;
      };
      case (null) {
        requestCounter += 1;
        let reqId = generateId("req", requestCounter);
        let newReq : ConnectionRequest = {
          id = reqId;
          fromUser = fromUsername;
          toUser = toUsername;
          status = #pending;
          createdAt = Time.now();
        };
        connectionRequests.add(reqId, newReq);
        return #ok;
      };
    };
  };

  public shared ({ caller }) func respondToRequest(callerUsername : Text, requestId : Text, accept : Bool) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    switch (connectionRequests.get(requestId)) {
      case (null) return #err("Request not found");
      case (?req) {
        if (req.toUser != username) return #err("Not authorized");
        connectionRequests.add(requestId, { req with status = if (accept) #accepted else #declined });
        #ok;
      };
    };
  };

  public shared ({ caller }) func getSentRequests(callerUsername : Text) : async [ConnectionRequest] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return [];
      case (?u) u;
    };
    var results : [ConnectionRequest] = [];
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#pending) {
          if (req.fromUser == username) {
            results := results.concat([req]);
          };
        };
        case (_) {};
      };
    };
    results;
  };

  public shared ({ caller }) func getPendingRequests(callerUsername : Text) : async [ConnectionRequest] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return [];
      case (?u) u;
    };
    var results : [ConnectionRequest] = [];
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#pending) {
          if (req.toUser == username) {
            switch (hasPendingRequest(username, req.fromUser)) {
              case (?_) {
                results := results.concat([req]);
              };
              case (null) {};
            };
          };
        };
        case (_) {};
      };
    };
    results;
  };

  public shared ({ caller }) func getFriends(callerUsername : Text) : async [UserProfile] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return [];
      case (?u) u;
    };
    var seen : Map.Map<Text, Bool> = Map.empty<Text, Bool>();
    var results : [UserProfile] = [];
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#accepted) {
          let friendUsername =
            if (req.fromUser == username) req.toUser
            else if (req.toUser == username) req.fromUser
            else "";
          if (friendUsername != "") {
            switch (seen.get(friendUsername)) {
              case (?_) {};
              case (null) {
                seen.add(friendUsername, true);
                switch (usersByUsername.get(friendUsername)) {
                  case (?profile) results := results.concat([profile]);
                  case (null) {};
                };
              };
            };
          };
        };
        case (_) {};
      };
    };
    results;
  };

  // ========== MESSAGING ==========

  public shared ({ caller }) func sendMessage(callerUsername : Text, toUsername : Text, content : Text) : async { #ok : Message; #err : Text } {
    let fromUsername = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    if (not areFriends(fromUsername, toUsername)) return #err("You must be connected first");
    messageCounter += 1;
    let msgId = generateId("msg", messageCounter);
    let msg : Message = {
      id = msgId;
      senderId = fromUsername;
      receiverId = toUsername;
      content;
      timestamp = Time.now();
      isRead = false;
      isSnap = false;
      snapBlobId = null;
      isEphemeral = false;
      snapViewed = false;
    };
    messages.add(msgId, msg);
    #ok(msg);
  };

  public shared ({ caller }) func sendSnap(callerUsername : Text, toUsername : Text, blobId : Text, isEphemeral : Bool, saveToChat : Bool) : async { #ok : Message; #err : Text } {
    let fromUsername = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    if (not areFriends(fromUsername, toUsername)) return #err("You must be connected first");
    messageCounter += 1;
    let msgId = generateId("snap", messageCounter);
    let snapLabel = if (saveToChat) "Snap (saved)" else "Snap";
    let msg : Message = {
      id = msgId;
      senderId = fromUsername;
      receiverId = toUsername;
      content = snapLabel;
      timestamp = Time.now();
      isRead = false;
      isSnap = true;
      snapBlobId = ?blobId;
      isEphemeral;
      snapViewed = false;
    };
    messages.add(msgId, msg);
    let currentScore = switch (snapScores.get(fromUsername)) {
      case (?s) s;
      case (null) 0;
    };
    snapScores.add(fromUsername, currentScore + 10);
    let key = streakKey(fromUsername, toUsername);
    let now = Time.now();
    let twentyFourHours : Int = 86_400_000_000_000;
    switch (streaks.get(key)) {
      case (null) {
        streaks.add(key, { user1 = fromUsername; user2 = toUsername; count = 1; lastSnapAt = now });
      };
      case (?entry) {
        let elapsed = now - entry.lastSnapAt;
        let newCount = if (elapsed > twentyFourHours) 1 else entry.count + 1;
        streaks.add(key, { entry with count = newCount; lastSnapAt = now });
      };
    };
    #ok(msg);
  };

  public shared ({ caller }) func getMessages(callerUsername : Text, withUsername : Text, since : Int) : async [Message] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return [];
      case (?u) u;
    };
    var results : [Message] = [];
    for ((_, msg) in messages.entries()) {
      if (msg.timestamp > since) {
        if ((msg.senderId == username and msg.receiverId == withUsername) or
            (msg.senderId == withUsername and msg.receiverId == username)) {
          if (not (msg.isSnap and msg.isEphemeral and msg.snapViewed)) {
            results := results.concat([msg]);
          };
        };
      };
    };
    results.sort(func(a : Message, b : Message) : { #less; #equal; #greater } {
      if (a.timestamp < b.timestamp) #less
      else if (a.timestamp > b.timestamp) #greater
      else #equal;
    });
  };

  public shared ({ caller }) func markMessageRead(callerUsername : Text, messageId : Text) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    switch (messages.get(messageId)) {
      case (null) return #err("Message not found");
      case (?msg) {
        if (msg.receiverId != username) return #err("Not authorized");
        messages.add(messageId, { msg with isRead = true });
        #ok;
      };
    };
  };

  public shared ({ caller }) func viewSnap(callerUsername : Text, messageId : Text) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    switch (messages.get(messageId)) {
      case (null) return #err("Message not found");
      case (?msg) {
        if (msg.receiverId != username) return #err("Not authorized");
        messages.add(messageId, { msg with isRead = true; snapViewed = true });
        #ok;
      };
    };
  };

  public shared ({ caller }) func getUnreadCount(callerUsername : Text) : async Nat {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return 0;
      case (?u) u;
    };
    var count = 0;
    for ((_, msg) in messages.entries()) {
      if (msg.receiverId == username and not msg.isRead) {
        count += 1;
      };
    };
    count;
  };

  public shared ({ caller }) func getPendingRequestCount(callerUsername : Text) : async Nat {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return 0;
      case (?u) u;
    };
    var count = 0;
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#pending) {
          if (req.toUser == username) {
            switch (hasPendingRequest(username, req.fromUser)) {
              case (?_) count += 1;
              case (null) {};
            };
          };
        };
        case (_) {};
      };
    };
    count;
  };

  public shared ({ caller }) func getConversations(callerUsername : Text) : async [{
    username : Text;
    displayName : Text;
    lastMessageContent : Text;
    lastMessageTimestamp : Int;
    unreadCount : Nat;
  }] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return [];
      case (?u) u;
    };
    type ConvEntry = { lastContent : Text; lastTs : Int; unread : Nat };
    let convMap = Map.empty<Text, ConvEntry>();
    for ((_, msg) in messages.entries()) {
      let otherUser =
        if (msg.senderId == username) msg.receiverId
        else if (msg.receiverId == username) msg.senderId
        else "";
      if (otherUser != "") {
        let existing = convMap.get(otherUser);
        let prevUnread = switch (existing) { case (?e) e.unread; case null 0 };
        let prevTs = switch (existing) { case (?e) e.lastTs; case null 0 };
        let prevContent = switch (existing) { case (?e) e.lastContent; case null "" };
        let newUnread = if (msg.receiverId == username and not msg.isRead) prevUnread + 1 else prevUnread;
        let (newContent, newTs) = if (msg.timestamp > prevTs) (msg.content, msg.timestamp) else (prevContent, prevTs);
        convMap.add(otherUser, { lastContent = newContent; lastTs = newTs; unread = newUnread });
      };
    };
    var results : [{ username : Text; displayName : Text; lastMessageContent : Text; lastMessageTimestamp : Int; unreadCount : Nat }] = [];
    for ((otherUser, conv) in convMap.entries()) {
      switch (usersByUsername.get(otherUser)) {
        case (?profile) {
          results := results.concat([{
            username = otherUser;
            displayName = profile.displayName;
            lastMessageContent = conv.lastContent;
            lastMessageTimestamp = conv.lastTs;
            unreadCount = conv.unread;
          }]);
        };
        case (null) {};
      };
    };
    results;
  };

  // ========== SNAP STORIES ==========

  public shared ({ caller }) func postStory(callerUsername : Text, blobId : Text, caption : Text) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) { return #err("Not logged in") };
      case (?u) { u };
    };
    if (username == "") { return #err("Empty username is not allowed") };
    let profile = if (username != "") {
      switch (usersByUsername.get(username)) {
        case (null) { return #err("User not found") };
        case (?p) { p };
      };
    } else { return #err("Empty username is not allowed") };
    storyCounter += 1;
    let storyId = generateId("story", storyCounter);
    let now = Time.now();
    let twentyFourHours : Int = 86_400_000_000_000;
    let story : Story = {
      id = storyId;
      authorUsername = username;
      authorDisplayName = profile.displayName;
      blobId;
      caption;
      timestamp = now;
      expiresAt = now + twentyFourHours;
    };
    stories.add(storyId, story);
    #ok;
  };

  public shared ({ caller }) func getFriendStories(callerUsername : Text) : async [Story] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return [];
      case (?u) u;
    };
    let now = Time.now();
    var results : [Story] = [];
    for ((_, story) in stories.entries()) {
      if (story.expiresAt > now) {
        if (story.authorUsername == username or areFriends(username, story.authorUsername)) {
          results := results.concat([story]);
        };
      };
    };
    results.sort(func(a : Story, b : Story) : { #less; #equal; #greater } {
      if (a.timestamp < b.timestamp) #less
      else if (a.timestamp > b.timestamp) #greater
      else #equal;
    });
  };

  public shared ({ caller }) func deleteStory(callerUsername : Text, storyId : Text) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    switch (stories.get(storyId)) {
      case (null) return #err("Story not found");
      case (?story) {
        if (story.authorUsername != username) {
          return #err("Not your story");
        };
        stories := stories.filter(func(k, v) { k != storyId });
        #ok;
      };
    };
  };

  // ========== REACTIONS ==========

  public shared ({ caller }) func addReaction(callerUsername : Text, messageId : Text, emoji : Text) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    switch (messages.get(messageId)) {
      case (null) return #err("Message not found");
      case (?_) {};
    };
    let existing = switch (reactions.get(messageId)) {
      case (?r) r;
      case (null) [];
    };
    var filtered : [Reaction] = [];
    for (r in existing.vals()) {
      if (r.username != username) {
        filtered := filtered.concat([r]);
      };
    };
    let newReaction : Reaction = {
      username;
      emoji;
      timestamp = Time.now();
    };
    reactions.add(messageId, filtered.concat([newReaction]));
    #ok;
  };

  public query func getReactions(messageId : Text) : async [Reaction] {
    switch (reactions.get(messageId)) {
      case (?r) r;
      case (null) [];
    };
  };

  // ========== GROUP CHATS ==========

  public shared ({ caller }) func createGroup(callerUsername : Text, groupName : Text, memberUsernames : [Text]) : async { #ok : GroupInfo; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    if (groupName.size() == 0) return #err("Group name cannot be empty");
    groupCounter += 1;
    let groupId = generateId("grp", groupCounter);
    var allMembers : [Text] = [username];
    for (m in memberUsernames.vals()) {
      if (m != username) {
        allMembers := allMembers.concat([m]);
      };
    };
    let group : GroupInfo = {
      id = groupId;
      name = groupName;
      createdBy = username;
      members = allMembers;
      createdAt = Time.now();
    };
    groups.add(groupId, group);
    #ok(group);
  };

  public shared ({ caller }) func getGroups(callerUsername : Text) : async [GroupInfo] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return [];
      case (?u) u;
    };
    var results : [GroupInfo] = [];
    for ((_, group) in groups.entries()) {
      for (member in group.members.vals()) {
        if (member == username) {
          results := results.concat([group]);
        };
      };
    };
    results;
  };

  public shared ({ caller }) func sendGroupMessage(callerUsername : Text, groupId : Text, content : Text) : async { #ok : GroupMessage; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    let group = switch (groups.get(groupId)) {
      case (null) return #err("Group not found");
      case (?g) g;
    };
    var isMember = false;
    for (m in group.members.vals()) {
      if (m == username) isMember := true;
    };
    if (not isMember) return #err("Not a member of this group");
    groupMsgCounter += 1;
    let msgId = generateId("gmsg", groupMsgCounter);
    let msg : GroupMessage = {
      id = msgId;
      groupId;
      senderUsername = username;
      content;
      timestamp = Time.now();
      isSnap = false;
      snapBlobId = null;
    };
    groupMessages.add(msgId, msg);
    #ok(msg);
  };

  public shared ({ caller }) func getGroupMessages(callerUsername : Text, groupId : Text, since : Int) : async [GroupMessage] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return [];
      case (?u) u;
    };
    let group = switch (groups.get(groupId)) {
      case (null) return [];
      case (?g) g;
    };
    var isMember = false;
    for (m in group.members.vals()) {
      if (m == username) isMember := true;
    };
    if (not isMember) return [];
    var results : [GroupMessage] = [];
    for ((_, msg) in groupMessages.entries()) {
      if (msg.groupId == groupId and msg.timestamp > since) {
        results := results.concat([msg]);
      };
    };
    results.sort(func(a : GroupMessage, b : GroupMessage) : { #less; #equal; #greater } {
      if (a.timestamp < b.timestamp) #less
      else if (a.timestamp > b.timestamp) #greater
      else #equal;
    });
  };

  // ========== SNAP STREAKS ==========

  public query func getStreak(user1 : Text, user2 : Text) : async Nat {
    let key = streakKey(user1, user2);
    let now = Time.now();
    let twentyFourHours : Int = 86_400_000_000_000;
    switch (streaks.get(key)) {
      case (null) 0;
      case (?entry) {
        if (now - entry.lastSnapAt > twentyFourHours) 0
        else entry.count;
      };
    };
  };

  // ========== SNAP SCORE ==========

  public query func getSnapScore(username : Text) : async Nat {
    switch (snapScores.get(username)) {
      case (?s) s;
      case (null) 0;
    };
  };

  // ========== GHOST MODE ==========

  public shared ({ caller }) func setGhostMode(callerUsername : Text, enabled : Bool) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    ghostMode.add(username, enabled);
    #ok;
  };

  public query func isGhostMode(username : Text) : async Bool {
    switch (ghostMode.get(username)) {
      case (?v) v;
      case (null) false;
    };
  };

  // ========== READ RECEIPTS TOGGLE ==========

  public shared ({ caller }) func setReadReceiptsEnabled(callerUsername : Text, enabled : Bool) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    readReceiptsEnabled.add(username, enabled);
    #ok;
  };

  public query func getReadReceiptsEnabled(username : Text) : async Bool {
    switch (readReceiptsEnabled.get(username)) {
      case (?v) v;
      case (null) true;
    };
  };

  // ========== DAILY LOGIN BONUS ==========

  public shared ({ caller }) func recordDailyLogin(callerUsername : Text) : async Nat {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return 0;
      case (?u) u;
    };
    let now = Time.now();
    let todayDay = utcDayFromNanos(now);
    switch (lastLoginDay.get(username)) {
      case (?lastDay) {
        if (lastDay == todayDay) return 0;
      };
      case (null) {};
    };
    lastLoginDay.add(username, todayDay);
    let currentScore = switch (snapScores.get(username)) {
      case (?s) s;
      case (null) 0;
    };
    snapScores.add(username, currentScore + 2);
    2;
  };

  // ========== LEADERBOARD ==========

  public query ({ caller }) func getLeaderboard(callerUsername : Text) : async [LeaderboardEntry] {
    let username = switch (usersByUsername.get(callerUsername)) {
      case (null) { return [] };
      case (_) { callerUsername };
    };
    var friendUsernames : [Text] = [];
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#accepted) {
          if (req.fromUser == username) {
            friendUsernames := friendUsernames.concat([req.toUser]);
          } else if (req.toUser == username) {
            friendUsernames := friendUsernames.concat([req.fromUser]);
          };
        };
        case (_) {};
      };
    };
    let participants = friendUsernames.concat([username]);
    var entries : [LeaderboardEntry] = [];
    for (u in participants.vals()) {
      switch (usersByUsername.get(u)) {
        case (?profile) {
          let score = switch (snapScores.get(u)) {
            case (?s) s;
            case (null) 0;
          };
          entries := entries.concat([{
            username = u;
            displayName = profile.displayName;
            snapScore = score;
            rank = 0;
          }]);
        };
        case (null) {};
      };
    };
    let sorted = entries.sort(func(a : LeaderboardEntry, b : LeaderboardEntry) : { #less; #equal; #greater } {
      if (a.snapScore > b.snapScore) #less
      else if (a.snapScore < b.snapScore) #greater
      else #equal;
    });
    var ranked : [LeaderboardEntry] = [];
    var rank = 1;
    for (e in sorted.vals()) {
      ranked := ranked.concat([{ e with rank }]);
      rank += 1;
    };
    if (ranked.size() <= 10) {
      ranked;
    } else {
      ranked.sliceToArray(0, 10);
    };
  };

  // ========== ACHIEVEMENTS ==========

  func hasStreak(username : Text, minCount : Nat) : Bool {
    for ((_, streak) in streaks.entries()) {
      let count = if (streak.user1 == username or streak.user2 == username) {
        let now = Time.now();
        let twentyFourHours : Int = 86_400_000_000_000;
        if (now - streak.lastSnapAt > twentyFourHours) {
          0;
        } else {
          streak.count;
        };
      } else { 0 };
      if (count >= minCount) { return true };
    };
    false;
  };

  public query ({ caller }) func getAchievements(callerUsername : Text) : async [Badge] {
    let username = switch (usersByUsername.get(callerUsername)) {
      case (null) { return [] };
      case (_) { callerUsername };
    };
    var friendCount = 0;
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#accepted) {
          if (req.fromUser == username or req.toUser == username) {
            friendCount += 1;
          };
        };
        case (_) {};
      };
    };
    let isFirstFriendAdded = friendCount > 0;
    let snapScore = switch (snapScores.get(username)) { case (null) { 0 }; case (?score) { score } };
    let badges : [Badge] = [
      {
        id = "first_snap_sent";
        name = "First Snap Sent";
        description = "Sent your first snap!";
        unlocked = snapScore > 0;
      },
      {
        id = "first_friend_added";
        name = "First Friend";
        description = "Made your first friend!";
        unlocked = isFirstFriendAdded;
      },
      {
        id = "streak_7";
        name = "Streak Smasher";
        description = "Maintain a 7-day snap streak";
        unlocked = hasStreak(username, 7);
      },
      {
        id = "streak_30";
        name = "Streak Legend";
        description = "Maintain a 30-day snap streak";
        unlocked = hasStreak(username, 30);
      },
      {
        id = "friends_10";
        name = "Socialite";
        description = "Make 10 friends";
        unlocked = friendCount >= 10;
      },
      {
        id = "snaps_50";
        name = "Snap Addict";
        description = "Send 50 snaps";
        unlocked = snapScore >= 500;
      },
      {
        id = "snaps_100";
        name = "Snap Maniac";
        description = "Send 100 snaps";
        unlocked = snapScore >= 1000;
      },
      {
        id = "score_500";
        name = "Snap Master";
        description = "Reach a snap score of 500";
        unlocked = snapScore >= 500;
      },
    ];
    badges;
  };

  // ========== TIME CAPSULE SNAPS ==========

  public shared ({ caller }) func sendCapsuleSnap(callerUsername : Text, toUsername : Text, blobId : Text, unlockAt : Int) : async { #ok : CapsuleMessage; #err : Text } {
    let senderUsername = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    if (not areFriends(senderUsername, toUsername)) {
      return #err("You must be connected first");
    };
    capsuleCounter += 1;
    let capsuleId = generateId("capsule", capsuleCounter);
    let capsule : CapsuleMessage = {
      id = capsuleId;
      senderId = senderUsername;
      receiverId = toUsername;
      blobId;
      unlockAt;
      isUnlocked = false;
      timestamp = Time.now();
    };
    capsuleMessages.add(capsuleId, capsule);
    #ok(capsule);
  };

  public shared ({ caller }) func getCapsuleMessages(callerUsername : Text, withUsername : Text) : async [CapsuleMessage] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) { return [] };
      case (?u) u;
    };
    var resultList : [CapsuleMessage] = [];
    for ((_, msg) in capsuleMessages.entries()) {
      if (
        (msg.senderId == username and msg.receiverId == withUsername) or
        (msg.senderId == withUsername and msg.receiverId == username)
      ) {
        let isUnlocked = Time.now() >= msg.unlockAt;
        let updatedMsg = { msg with isUnlocked };
        if (isUnlocked and not msg.isUnlocked) {
          capsuleMessages.add(msg.id, updatedMsg);
        };
        resultList := resultList.concat([updatedMsg]);
      };
    };
    resultList;
  };

  public query ({ caller }) func getCapsuleStatus(callerUsername : Text, messageId : Text) : async ?CapsuleMessage {
    switch (capsuleMessages.get(messageId)) {
      case (?msg) {
        switch (resolveUsername(callerUsername, caller)) {
          case (null) { return null };
          case (?u) {
            if (msg.senderId != u and msg.receiverId != u) { return null };
          };
        };
        let isUnlocked = Time.now() >= msg.unlockAt;
        ?{ msg with isUnlocked };
      };
      case (null) { null };
    };
  };

  // ========== ADMIN ==========

  public shared ({ caller }) func clearAllData() : async { #ok } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
    usersByUsername := Map.empty<Text, UserProfile>();
    usersByPrincipal := Map.empty<Text, Text>();
    connectionRequests := Map.empty<Text, ConnectionRequest>();
    messages := Map.empty<Text, Message>();
    messageCounter := 0;
    requestCounter := 0;
    stories := Map.empty<Text, Story>();
    reactions := Map.empty<Text, [Reaction]>();
    groups := Map.empty<Text, GroupInfo>();
    groupMessages := Map.empty<Text, GroupMessage>();
    streaks := Map.empty<Text, StreakEntry>();
    snapScores := Map.empty<Text, Nat>();
    storyCounter := 0;
    groupCounter := 0;
    groupMsgCounter := 0;
    ghostMode := Map.empty<Text, Bool>();
    readReceiptsEnabled := Map.empty<Text, Bool>();
    lastLoginDay := Map.empty<Text, Int>();
    voiceMessagesSent := Map.empty<Text, Nat>();
    locationSharesSent := Map.empty<Text, Nat>();
    storiesPostedCount := Map.empty<Text, Nat>();
    groupsCreatedCount := Map.empty<Text, Nat>();
    capsuleMessages := Map.empty<Text, CapsuleMessage>();
    capsuleCounter := 0;
    #ok;
  };

  // ========== REQUIRED USER PROFILE FUNCTIONS ==========

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    switch (getPrincipalUsername(caller)) {
      case (?username) {
        usersByUsername.get(username);
      };
      case (null) {
        null;
      };
    };
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    switch (getPrincipalUsername(user)) {
      case (?username) {
        usersByUsername.get(username);
      };
      case (null) {
        null;
      };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    switch (getPrincipalUsername(caller)) {
      case (?username) {
        usersByUsername.add(username, profile);
      };
      case (null) {
        Runtime.trap("User not found");
      };
    };
  };
};
