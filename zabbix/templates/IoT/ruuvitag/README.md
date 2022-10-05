# RuuviTag Zabbix integration instructions

1. Get [Bluewalker](https://gitlab.com/jtaimisto/bluewalker)
2. Run in screen, during boot, however you like: 

sudo btmgmt --index hci0 power off && sudo bluewalker  -device hci0 -ruuvi -duration -1 >>/tmp/ruuvitag.txt

3. In Zabbix, add the template from this directory to your desired host.
