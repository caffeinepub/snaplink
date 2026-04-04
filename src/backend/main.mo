import Text "mo:core/Text";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Nat32 "mo:core/Nat32";

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

  // ========== STATE ==========

  var usersByUsername : Map.Map<Text, UserProfile> = Map.empty<Text, UserProfile>();
  var usersByPrincipal : Map.Map<Text, Text> = Map.empty<Text, Text>();
  var connectionRequests : Map.Map<Text, ConnectionRequest> = Map.empty<Text, ConnectionRequest>();
  var messages : Map.Map<Text, Message> = Map.empty<Text, Message>();
  var messageCounter : Nat = 0;
  var requestCounter : Nat = 0;

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

  public shared ({ caller }) func updateProfile(displayName : Text, bio : Text) : async { #ok; #err : Text } {
    switch (getPrincipalUsername(caller)) {
      case (null) return #err("Not logged in");
      case (?username) {
        switch (usersByUsername.get(username)) {
          case (null) return #err("User not found");
          case (?profile) {
            usersByUsername.add(username, { profile with displayName; bio });
            #ok;
          };
        };
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

  // ========== CONNECTIONS ==========

  public shared ({ caller }) func sendConnectionRequest(toUsername : Text) : async { #ok; #err : Text } {
    let fromUsername = switch (getPrincipalUsername(caller)) {
      case (null) return #err("Not logged in");
      case (?u) u;
    };
    if (fromUsername == toUsername) return #err("Cannot connect with yourself");
    switch (usersByUsername.get(toUsername)) {
      case (null) return #err("User not found");
      case (?_) {};
    };
    for ((_, req) in connectionRequests.entries()) {
      if ((req.fromUser == fromUsername and req.toUser == toUsername) or
          (req.fromUser == toUsername and req.toUser == fromUsername)) {
        return #err("Connection already exists");
      };
    };
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
    #ok;
  };

  public shared ({ caller }) func respondToRequest(requestId : Text, accept : Bool) : async { #ok; #err : Text } {
    let username = switch (getPrincipalUsername(caller)) {
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

  public shared ({ caller }) func getPendingRequests() : async [ConnectionRequest] {
    let username = switch (getPrincipalUsername(caller)) {
      case (null) return [];
      case (?u) u;
    };
    var results : [ConnectionRequest] = [];
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#pending) {
          if (req.toUser == username) {
            results := results.concat([req]);
          };
        };
        case (_) {};
      };
    };
    results;
  };

  public shared ({ caller }) func getFriends() : async [UserProfile] {
    let username = switch (getPrincipalUsername(caller)) {
      case (null) return [];
      case (?u) u;
    };
    var results : [UserProfile] = [];
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#accepted) {
          let friendUsername =
            if (req.fromUser == username) req.toUser
            else if (req.toUser == username) req.fromUser
            else "";
          if (friendUsername != "") {
            switch (usersByUsername.get(friendUsername)) {
              case (?profile) results := results.concat([profile]);
              case (null) {};
            };
          };
        };
        case (_) {};
      };
    };
    results;
  };

  // ========== MESSAGING ==========

  public shared ({ caller }) func sendMessage(toUsername : Text, content : Text) : async { #ok : Message; #err : Text } {
    let fromUsername = switch (getPrincipalUsername(caller)) {
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

  public shared ({ caller }) func sendSnap(toUsername : Text, blobId : Text, isEphemeral : Bool, saveToChat : Bool) : async { #ok : Message; #err : Text } {
    let fromUsername = switch (getPrincipalUsername(caller)) {
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
    #ok(msg);
  };

  public shared ({ caller }) func getMessages(withUsername : Text, since : Int) : async [Message] {
    let username = switch (getPrincipalUsername(caller)) {
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

  public shared ({ caller }) func markMessageRead(messageId : Text) : async { #ok; #err : Text } {
    let username = switch (getPrincipalUsername(caller)) {
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

  public shared ({ caller }) func viewSnap(messageId : Text) : async { #ok; #err : Text } {
    let username = switch (getPrincipalUsername(caller)) {
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

  public shared ({ caller }) func getUnreadCount() : async Nat {
    let username = switch (getPrincipalUsername(caller)) {
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

  public shared ({ caller }) func getPendingRequestCount() : async Nat {
    let username = switch (getPrincipalUsername(caller)) {
      case (null) return 0;
      case (?u) u;
    };
    var count = 0;
    for ((_, req) in connectionRequests.entries()) {
      switch (req.status) {
        case (#pending) {
          if (req.toUser == username) count += 1;
        };
        case (_) {};
      };
    };
    count;
  };

  public shared ({ caller }) func getConversations() : async [{
    username : Text;
    displayName : Text;
    lastMessageContent : Text;
    lastMessageTimestamp : Int;
    unreadCount : Nat;
  }] {
    let username = switch (getPrincipalUsername(caller)) {
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
};
