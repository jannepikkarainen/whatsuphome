#!/bin/zsh
system_profiler SPBluetoothDataType 2>/dev/null | grep -A10 "Valcoitus Bass:" | grep "Connected:" | cut -d ':' -f2 | xargs -I '{}' zabbix_sender -z your.zabbix.server -s "your host" -k valco.connected -o '{}'
