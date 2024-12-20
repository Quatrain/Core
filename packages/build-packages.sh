#!/bin/bash

# Check if a command argument is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <command>"
    echo "Example: $0 build or $0 install"
    exit 1
fi

COMMAND=$1  # The command to run (e.g., build, install)

# Change to the packages directory
cd /Users/crapougnax/CODE/QUATRAIN/Core/packages || exit 1

# Iterate over all directories
for dir in */; do
    echo "Running '$COMMAND' in $dir"
    cd "$dir" || exit 1  # Navigate into the directory
    
    # Check if package.json exists
    if [ -f "package.json" ]; then
        yarn "$COMMAND" || { echo "Command '$COMMAND' failed in $dir"; exit 1; }
    else
        echo "No package.json in $dir, skipping."
    fi
    
    cd ..  # Return to the parent directory
done
