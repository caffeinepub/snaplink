import Text "mo:core/Text";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Nat32 "mo:core/Nat32";
import Storage "blob-storage/Storage";
import Prim "mo:prim";
import Runtime "mo:core/Runtime";

actor SnapLink {

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

  // ── New Feature Types ──────────────────────────────────────────────────────

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

  // ========== STABLE STATE ==========
  // Using stable vars so data persists across canister upgrades.

  stable var stableUsersByUsername : [(Text, UserProfile)] = [];
  stable var stableUsersByPrincipal : [(Text, Text)] = [];
  stable var stableConnectionRequests : [(Text, ConnectionRequest)] = [];
  stable var stableMessages : [(Text, Message)] = [];
  stable var stableMessageCounter : Nat = 0;
  stable var stableRequestCounter : Nat = 0;

  // Feature stable state
  stable var stableStories : [(Text, Story)] = [];
  stable var stableReactions : [(Text, [Reaction])] = [];
  stable var stableGroups : [(Text, GroupInfo)] = [];
  stable var stableGroupMessages : [(Text, GroupMessage)] = [];
  stable var stableStreaks : [(Text, StreakEntry)] = [];
  stable var stableSnapScores : [(Text, Nat)] = [];
  stable var stableStoryCounter : Nat = 0;
  stable var stableGroupCounter : Nat = 0;
  stable var stableGroupMsgCounter : Nat = 0;

  // New v42 stable state
  stable var stableGhostMode : [(Text, Bool)] = [];
  stable var stableReadReceiptsEnabled : [(Text, Bool)] = [];
  stable var stableLastLoginDay : [(Text, Int)] = []; // username -> UTC day number

  // ========== STATE (loaded from stable on init) ==========

  var usersByUsername : Map.Map<Text, UserProfile> = Map.fromIter(stableUsersByUsername.vals());
  var usersByPrincipal : Map.Map<Text, Text> = Map.fromIter(stableUsersByPrincipal.vals());
  var connectionRequests : Map.Map<Text, ConnectionRequest> = Map.fromIter(stableConnectionRequests.vals());
  var messages : Map.Map<Text, Message> = Map.fromIter(stableMessages.vals());
  var messageCounter : Nat = stableMessageCounter;
  var requestCounter : Nat = stableRequestCounter;

  // Feature state
  var stories : Map.Map<Text, Story> = Map.fromIter(stableStories.vals());
  var reactions : Map.Map<Text, [Reaction]> = Map.fromIter(stableReactions.vals());
  var groups : Map.Map<Text, GroupInfo> = Map.fromIter(stableGroups.vals());
  var groupMessages : Map.Map<Text, GroupMessage> = Map.fromIter(stableGroupMessages.vals());
  var streaks : Map.Map<Text, StreakEntry> = Map.fromIter(stableStreaks.vals());
  var snapScores : Map.Map<Text, Nat> = Map.fromIter(stableSnapScores.vals());
  var storyCounter : Nat = stableStoryCounter;
  var groupCounter : Nat = stableGroupCounter;
  var groupMsgCounter : Nat = stableGroupMsgCounter;

  // New v42 state
  var ghostMode : Map.Map<Text, Bool> = Map.fromIter(stableGhostMode.vals());
  var readReceiptsEnabled : Map.Map<Text, Bool> = Map.fromIter(stableReadReceiptsEnabled.vals());
  var lastLoginDay : Map.Map<Text, Int> = Map.fromIter(stableLastLoginDay.vals());

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

    // v42
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

    // v42
    ghostMode := Map.fromIter(stableGhostMode.vals());
    readReceiptsEnabled := Map.fromIter(stableReadReceiptsEnabled.vals());
    lastLoginDay := Map.fromIter(stableLastLoginDay.vals());
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
        case (?_) return ?callerUsername;
        case (null) return null;
      };
    };
    getPrincipalUsername(caller);
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

  // Returns UTC day number from nanosecond timestamp
  func utcDayFromNanos(nanos : Int) : Int {
    let secsPerDay : Int = 86_400;
    let nanosPerSec : Int = 1_000_000_000;
    nanos / (secsPerDay * nanosPerSec);
  };

  // ========== ADMIN ==========

  public func clearAllData() : async { #ok } {
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
    stableUsersByUsername := [];
    stableUsersByPrincipal := [];
    stableConnectionRequests := [];
    stableMessages := [];
    stableMessageCounter := 0;
    stableRequestCounter := 0;
    stableStories := [];
    stableReactions := [];
    stableGroups := [];
    stableGroupMessages := [];
    stableStreaks := [];
    stableSnapScores := [];
    stableStoryCounter := 0;
    stableGroupCounter := 0;
    stableGroupMsgCounter := 0;
    ghostMode := Map.empty<Text, Bool>();
    readReceiptsEnabled := Map.empty<Text, Bool>();
    lastLoginDay := Map.empty<Text, Int>();
    stableGhostMode := [];
    stableReadReceiptsEnabled := [];
    stableLastLoginDay := [];
    #ok;
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
    // Update snap score for sender
    let currentScore = switch (snapScores.get(fromUsername)) {
      case (?s) s;
      case (null) 0;
    };
    snapScores.add(fromUsername, currentScore + 10);
    // Update streak
    let key = streakKey(fromUsername, toUsername);
    let now = Time.now();
    let twentyFourHours : Int = 86_400_000_000_000; // nanoseconds
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
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    let profile = switch (usersByUsername.get(username)) {
      case (null) return #err("User not found");
      case (?p) p;
    };
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

  // Returns non-expired stories from friends of the caller
  public shared ({ caller }) func getFriendStories(callerUsername : Text) : async [Story] {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return [];
      case (?u) u;
    };
    let now = Time.now();
    var results : [Story] = [];
    for ((_, story) in stories.entries()) {
      if (story.expiresAt > now) {
        // Include own stories + friends' stories
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

  // ========== REACTIONS ==========

  public shared ({ caller }) func addReaction(callerUsername : Text, messageId : Text, emoji : Text) : async { #ok; #err : Text } {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    // Verify message exists
    switch (messages.get(messageId)) {
      case (null) return #err("Message not found");
      case (?_) {};
    };
    let existing = switch (reactions.get(messageId)) {
      case (?r) r;
      case (null) [];
    };
    // Remove existing reaction from this user if any, then add new one
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
    // Ensure creator is always in members
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
    // Check membership
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
        // If streak is expired, return 0
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

  // ========== GHOST MODE (v42) ==========

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

  // ========== READ RECEIPTS TOGGLE (v42) ==========

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
      case (null) true; // default is enabled
    };
  };

  // ========== DAILY LOGIN BONUS (v42) ==========

  // Awards +2 snap score points once per UTC day. Returns points awarded (0 if already done today).
  public shared ({ caller }) func recordDailyLogin(callerUsername : Text) : async Nat {
    let username = switch (resolveUsername(callerUsername, caller)) {
      case (null) return 0;
      case (?u) u;
    };
    let now = Time.now();
    let todayDay = utcDayFromNanos(now);
    switch (lastLoginDay.get(username)) {
      case (?lastDay) {
        if (lastDay == todayDay) return 0; // already awarded today
      };
      case (null) {};
    };
    // Award bonus
    lastLoginDay.add(username, todayDay);
    let currentScore = switch (snapScores.get(username)) {
      case (?s) s;
      case (null) 0;
    };
    snapScores.add(username, currentScore + 2);
    2;
  };

  // ========== BLOB STORAGE (inlined from blob-storage/Mixin) ==========

  type ExternalBlob = Storage.ExternalBlob;

  transient let _caffeineStorageState : Storage.State = Storage.new();

  type _CaffeineStorageRefillInformation = {
    proposed_top_up_amount : ?Nat;
  };

  type _CaffeineStorageRefillResult = {
    success : ?Bool;
    topped_up_amount : ?Nat;
  };

  type _CaffeineStorageCreateCertificateResult = {
    method : Text;
    blob_hash : Text;
  };

  public shared ({ caller }) func _caffeineStorageRefillCashier(refillInformation : ?_CaffeineStorageRefillInformation) : async _CaffeineStorageRefillResult {
    let cashier = await Storage.getCashierPrincipal();
    if (cashier != caller) {
      Runtime.trap("Unauthorized access");
    };
    await Storage.refillCashier(_caffeineStorageState, cashier, refillInformation);
  };

  public shared ({ caller }) func _caffeineStorageUpdateGatewayPrincipals() : async () {
    await Storage.updateGatewayPrincipals(_caffeineStorageState);
  };

  public query ({ caller }) func _caffeineStorageBlobIsLive(hash : Blob) : async Bool {
    Prim.isStorageBlobLive(hash);
  };

  public query ({ caller }) func _caffeineStorageBlobsToDelete() : async [Blob] {
    if (not Storage.isAuthorized(_caffeineStorageState, caller)) {
      Runtime.trap("Unauthorized access");
    };
    let deadBlobs = Prim.getDeadBlobs();
    switch (deadBlobs) {
      case (null) {
        [];
      };
      case (?deadBlobs) {
        deadBlobs.sliceToArray(0, 10000);
      };
    };
  };

  public shared ({ caller }) func _caffeineStorageConfirmBlobDeletion(blobs : [Blob]) : async () {
    if (not Storage.isAuthorized(_caffeineStorageState, caller)) {
      Runtime.trap("Unauthorized access");
    };
    Prim.pruneConfirmedDeadBlobs(blobs);
    type GC = actor {
      __motoko_gc_trigger : () -> async ();
    };
    let myGC = actor (debug_show (Prim.getSelfPrincipal<system>())) : GC;
    await myGC.__motoko_gc_trigger();
  };

  public shared func _caffeineStorageCreateCertificate(blobHash : Text) : async _CaffeineStorageCreateCertificateResult {
    {
      method = "upload";
      blob_hash = blobHash;
    };
  };

};
