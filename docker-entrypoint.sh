#!/bin/sh

/usr/bin/supervisord -c /var/lib/rnode/xray/supervisor.conf &
sleep 1
exec "$@"