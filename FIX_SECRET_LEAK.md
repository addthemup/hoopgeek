# Fix Secret Leak - Quick Guide

## 🚨 Problem
GitHub blocked your push because you committed Google OAuth credentials.

## ✅ Solution (Run These Commands)

### Step 1: Remove the secret file from git
```bash
cd /Users/adam/Desktop/hoopgeek

# Remove the file from git tracking (keeps local copy)
git rm --cached supabase/client_secret_695190952325-luvbbl0qhl71qtnb96j81gmljigec546.apps.googleusercontent.com.json

# Commit the removal
git add .gitignore
git commit -m "Remove OAuth secrets from git, update .gitignore"
```

### Step 2: Push to GitHub
```bash
git push origin main
```

### Step 3: IMPORTANT - Regenerate OAuth Credentials

⚠️ **The credentials are now exposed!** You MUST regenerate them:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth client ID
3. Delete it or regenerate the secret
4. Download new credentials
5. Save them OUTSIDE of git (or in a secure location)

---

## 📝 Alternative: Clean Git History (If needed)

If you want to completely remove the secret from git history:

```bash
# This rewrites git history - use with caution!
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch supabase/client_secret*.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (only if repo is private and no one else is using it)
git push origin --force --all
```

⚠️ **Only do this if:**
- Your repo is PRIVATE
- No one else has cloned it yet
- You understand it rewrites history

---

## ✅ Prevention Checklist

- [x] Updated .gitignore
- [ ] Removed secret file from git
- [ ] Committed and pushed
- [ ] Regenerated OAuth credentials
- [ ] Stored new credentials securely

---

## 🔐 Best Practices Going Forward

1. **Never commit secrets** - use environment variables
2. **Check before committing**: `git diff --cached`
3. **Use .gitignore** for all sensitive files
4. **Store credentials** in password manager
5. **Use environment variables** in code

---

## 🆘 If You Need Help

GitHub provides a way to allow the secret (NOT recommended):
- Click the link in the error message
- But ONLY if you're absolutely sure it's safe

**Better approach:** Remove it properly as shown above!

