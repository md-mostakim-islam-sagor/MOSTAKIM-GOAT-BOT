---
name: GoatBot onFirstChat architecture
description: onFirstChat in mostakim.js is a Set (not array); commands register via _commandNames property
---

GoatBot.onFirstChat is a `Set` (used to track threadIDs that have chatted first time).
Command names are stored in `GoatBot.onFirstChat._commandNames` (array property on the Set).

**Why:** mostakim.js changed onFirstChat from array to Set for O(1) lookup, but loadScripts.js and cmd.js still used .push() on it which fails on Set.

**How to apply:** When a command has onFirstChat, do:
```js
if (!GoatBot.onFirstChat._commandNames) GoatBot.onFirstChat._commandNames = [];
GoatBot.onFirstChat._commandNames.push(commandName);
```
Never call GoatBot.onFirstChat.push() directly.
