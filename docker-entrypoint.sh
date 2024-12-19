#!/bin/sh

echo "Starting entrypoint script..."
supervisord &
echo "Supervisord started"
sleep 1
echo "Executing: $@"
exec "$@"