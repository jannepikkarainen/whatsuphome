# Currently monitored 

# Air conditioner (MQTT)
- Power status
- Fan speed
- Mode
- Target temperature
- Ambient temperature
- Can also be controlled from custom Zabbix context menu

# Air quality (outdoors)
- Data being fetched from OpenAQ using Zabbix HTTP agent item type

# Baby girl
- Stroller cabin temperature (monitored with a RuuviTag)
- Cry detection (by iPhone/Apple Watch, events sent to Zabbix using Shortcuts automation and a text file)

# Backups
- Monitor BackupPC backups so my home Zabbix won't get lost
- Monitor Apple Time Machine backups age so my other stuff won't get lost

# "Banana"
- Check for color

# CCTV camera
- Reachability
- Power status
- Stream condition
- Firmware

# Cozify
- Monitor that my custom scripts are properly being run

# Countdown timer
- Was "Is it Zabbix Summit 2022 yet?", but of course possible to countdown to any date

# Door sensors
- Reachability 
- Battery status
- Last open/close event
- Used for my facial cream monitoring, too

# Elasticsearch
- What, who wouldn't have Elasticsearch at home? Monitored by standard Zabbix Elasticsearch template

# Electricity
- Current average price per kWh (Nordpool)
- Finland's total power consumption (Fingrid)

# FlightGear
- Aircraft coordinates
- Altitude
- Speed

# Headset
- Power status

# Home router
- All the usual router stuff over SNMP
- NetFlow (coming soon, maybe)

# Jenkins
- What, who wouldn't have Jenkins at home? Monitored using the standard Zabbix Jenkins template

# Laptop webcam
- In use or not?

# Lights
- Power status
- Brightness
- Hue
- Saturation
- Reachability
- Firmware version

# Logs
- Central syslogs received by Zabbix

# Lunch menu
- Notify when a new menu is published

# Motion sensors
- Battery level
- Motion detected events
- Light level (lux) if supported by sensor

# MySQL 
- Zabbix server MySQL, monitored by standard Zabbix MySQL template

# Northern lights
- Current probability of seeing them

# Philips OneBlade shaver
- Estimated runtime left based on audio frequency

# Power sockets
- Reachability
- Power status

# Raspberry Pi 4
- Runs my Zabbix
- Monitored by Zabbix Agent2

# Roomba iRobot vacuum cleaner (dumb model with no IoT functionality)
- Monitor how long its moving
- Monitored using RuuviTag

# Smoke/Fire alarm
- Reachability
- Battery level
- Alert status

# Sonos smart speaker
- Power status
- Reachability
- Volume level
- Play status (stopped/paused/playing)
- Current song

# Thermometers
- Temperature
- Humidity
- Reachability
- Battery level

# TV
- Power status (estimated by its IMCP ping)

# Weather
- Monitored by built-in Zabbix OpenWeather template

---

# Other features

# Blender 3D software integration
- Custom Python scripts call Blender API and change alerting objects in scene to be red

# Star Wars xscreensaver module integration
- Send Zabbix alerts over Real-time export functionality to another laptop, which then parses the JSON to text, the text then used by the xscreensaver module

# IoT remote integration
- Send events to Zabbix using a remote

# Take screenshot of websites
- Selenium scripts can take screenshots of website when they alert, or anytime from a Zabbix context menu

# Fairy tale alert template
- What's a better way to put your baby to sleep than read her a different kind of fairy tale?

