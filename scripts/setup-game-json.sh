#!/bin/bash
# Setup script to make game JSON files accessible for development
# This creates a symlink from public/game-data to scripts/feed

echo "🏀 Setting up game JSON files for development..."

# Create public/game-data directory if it doesn't exist
mkdir -p public/game-data

# Check if symlink already exists
if [ -L "public/game-data/feed" ]; then
    echo "✅ Symlink already exists"
elif [ -d "public/game-data/feed" ]; then
    echo "⚠️  Directory exists (not a symlink). Remove it first if you want to use a symlink."
else
    # Create symlink
    cd public/game-data
    ln -s ../../scripts/feed feed
    cd ../..
    echo "✅ Created symlink: public/game-data/feed -> scripts/feed"
fi

# Also try creating direct symlinks for individual access
# This allows /game-data/{gameId}.json to work
if [ ! -d "public/game-data" ]; then
    mkdir -p public/game-data
fi

echo ""
echo "📝 Note: The game page will try to load JSON files from:"
echo "   - /scripts/feed/{gameId}.json"
echo "   - /game-data/{gameId}.json"
echo "   - /{gameId}.json"
echo ""
echo "✅ Setup complete! JSON files should now be accessible."
