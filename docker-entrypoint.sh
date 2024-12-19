#!/bin/sh

/usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf &


sleep 1


exec "$@" 