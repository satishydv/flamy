Yes — this is an **important product decision**, especially for a dating app. I would **not make chat and calls open to everyone by default**.

### What usually happens in dating apps

The common model is:

```text
User A discovers User B
        ↓
User A likes User B ❤️
        ↓
User B likes User A ❤️
        ↓
       MATCH 🎉
        ↓
Chat becomes available 💬
        ↓
Voice / Video call becomes available 📞📹
```

This is closer to **Tinder/Bumble/Hinge** than Instagram.

The reason is mainly **privacy and spam prevention**. If absolutely anyone could message or call anyone, users can quickly get unwanted messages, harassment, and spam.

### I recommend this for your app

I'd use **3 levels of interaction**:

| Action            | Before match | After match |
| ----------------- | ------------ | ----------- |
| View profile      | ✅            | ✅           |
| Like              | ✅            | —           |
| Send chat         | ❌            | ✅           |
| Voice call        | ❌            | ✅           |
| Video call        | ❌            | ✅           |
| Send images/files | ❌            | ✅           |
| Block/report      | ✅            | ✅           |

But there's an interesting feature you can add:

### "Message Request" — optional

You could allow a user to send **one limited introductory message** before matching.

For example:

> 👋 "Hey, I noticed you also like photography!"

The other person gets:

```text
Aisha wants to message you

"Hey, I noticed you also like photography!"

[ Accept ]   [ Decline ]
```

If accepted → conversation opens.

If declined → they can't continue messaging.

This gives you some of the **Instagram request model** without opening your users to unlimited DMs.

---

## For calls, I'd be stricter

I strongly recommend:

**No calls before a match.**

Even if you allow message requests, don't allow:

📞 Voice call
📹 Video call

until the recipient has accepted/matched.

Otherwise imagine:

```text
Random user finds Aisha
        ↓
📹 VIDEO CALL
        ↓
Aisha gets an unexpected call
```

That's a terrible dating-app experience.

Instead:

```text
LIKE
 ↓
MATCH
 ↓
CHAT
 ↓
Both users can call
```

And you can give users additional controls:

```text
Settings → Calls

☑ Allow voice calls from matches
☑ Allow video calls from matches

○ Anyone I've matched with
○ Nobody
```

You can even add:

**"Only allow calls after we've exchanged at least X messages"**

if you want stronger safety.

---

### Your existing Messages screen fits this model nicely

Your **New Matches** section is actually perfect for it.

For example:

```text
NEW MATCHES

Aisha     Sophia     Chloe     Elena
 92%       90%        96%        89%

        ↓ tap Aisha

┌─────────────────────────────┐
│ Aisha, 26 ✓                 │
│ ● Online                    │
│                             │
│     💬       📞       📹     │
│    Chat    Voice    Video   │
└─────────────────────────────┘
```

So the user understands:

**Match = permission to communicate.**

---

## One thing I'd change in your backend

Don't simply have:

```text
canChat = true/false
```

Build an actual **relationship/interaction state**.

For example:

```text
NONE
   ↓
LIKED
   ↓
MATCHED
   ↓
BLOCKED
```

And potentially:

```text
NONE
 ↓
MESSAGE_REQUESTED
 ↓
REQUEST_ACCEPTED
 ↓
MATCHED / CHAT_ENABLED
```

Then your authorization logic can be:

```text
Can message?
    ↓
Is user blocked? → NO
    ↓
Are they matched? → YES
    ↓
Allow message
```

For calls:

```text
Can call?
    ↓
Is user blocked? → NO
    ↓
Are they matched? → NO → reject
    ↓
Does recipient allow calls? → NO → reject
    ↓
Allow call
```

This will make your app **much safer and easier to scale** when you add more features.

### My recommendation for your particular app

I'd use:

**Discovery → Like → Mutual Match → Chat → Voice/Video**

with an **optional message request** feature later.

That gives you the familiar dating-app experience while still leaving room for the broader social features you're planning.
