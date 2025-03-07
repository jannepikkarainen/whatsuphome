# Currently monitored 

# AdGuard Home
- Is the ad-blocker enabled?
- Number of DNS queries
- Number of DNS queries blocked
- Number of times parental filter did hit
- Number of times safe search was enforced
- Average processing time

# Air conditioner (MQTT)
- Power status
- Fan speed
- Mode
- Target temperature
- Ambient temperature
- Can also be controlled from custom Zabbix context menu

# Air humidifier
- Power status

# Airport departures/arrivals
- Track Helsinki airport departures/arrivals through Grafana's Infinity data source

# Air quality (outdoors)
- Data being fetched from OpenAQ using Zabbix HTTP agent item type

# Apple products
- Apple Watch and iPhone monitored through Home Assistant's HomeKit Controller integration, data brought to Zabbix over Home Assistant API
- Monitored data includes for example steps, average pace, distance, altitude, GPS accuracy, vertical accuracy, mobile connection type (cellular/wifi), current activity, location and so much more.
- Send info about the currently playing music (on Apple Music) to Zabbix
- Monitor Apple M-series CPU/GPU/ANE

# Baby girl
- Stroller cabin temperature (monitored with a RuuviTag)
- Cry detection (by iPhone/Apple Watch, events sent to Zabbix using Shortcuts automation and a text file)
- Bedtime guesstimate based on bedroom Philips Hue light strip night light mode status

# Backups
- Monitor BackupPC backups so my home Zabbix won't get lost
- Monitor Apple Time Machine backups age so my other stuff won't get lost

# "Banana"
- Check for color

# Car
- Geolocation sent to Zabbix whenever I start the car

# CCTV camera
- Reachability
- Power status
- Stream condition
- Firmware

# CO2 levels
- Netatmo IoT device & HomeKit & some Siri Shortcuts feeding data to Zabbix

# Cozify
- Monitor that my custom scripts are properly being run

# Countdown timer
- Was "Is it Zabbix Summit 2022 yet?", but of course possible to countdown to any date

# Docker
- Home Assistant, HashiCorp Vault, Ansible Semaphore, some other Docker instances running on my Raspberry Pi or laptop are being monitored for their status through standard Zabbix Docker template

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

# HAProxy
- Who wouldn't need HAProxy in front of their Selenium instances at home?
- Monitored using Zabbix built-in HAProxy template

# HashiCorp Vault
- As my Zabbix is using HashiCorp Vault for credentials, I'm also using the Zabbix built-in HashiCorp Vault template for monitoring it

# Headset
- Power status

# Home router
- All the usual router stuff over SNMP
- NetFlow (coming soon, maybe)
- Monitor Wi-Fi signal strength of the connected devices

# HP LaserJet Pro MFP M28a
- An USB-connected laser printer
- Monitored using ipptool 
- Returns back printer states, uptime, remaining toner level, firmware version, some other details

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

# Maritime traffic
- Monitor any sea vessel for its heading, speed, latitude and longitude

# Mobile data usage
- Based on my OpenVPN connection back to home network whenever I am not at home

# Motion sensors
- Battery level
- Motion detected events
- Light level (lux) if supported by sensor

# MySQL 
- Zabbix server MySQL, monitored by standard Zabbix MySQL template

# NetFlow
- Implemented with softflowd, ELK stack, ElastiFlow and Grafana Elasticsearch plugin; work to get my own NetFlow implementation working on Zabbix is underway

# Northern lights
- Current probability of seeing them

# OPNSense
- Monitored with the official OPNSense SNMP template by Zabbix
- Also monitored via Zabbix agent, as OPNSense plugins do offer that. Agent gives back a bit different kind of data than the SNMP template, so using both is beneficial

# Philips OneBlade shaver
- Estimated runtime left based on audio frequency

# Product prices
- Some product prices from a specific Finnish company, requested by my wife

# Proxmox VE
- Monitoring my Proxmox VE environment with the native Proxmox template provided by Zabbix

# Power sockets
- Reachability
- Power status

# Raspberry Pi 4
- Runs my Zabbix
- Monitored by Zabbix Agent2

# Roomba iRobot vacuum cleaner (dumb model with no IoT functionality)
- Monitor how long its moving
- Monitored using RuuviTag

# RSS
- Follows the RSS feed of whatsuphome.fi just to make sure it's OK

# Selenium
- Server status
- Server messages
- Node status

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

# Typing speed
- Through typespeed command line game high score file
- Characters per second with and without enter/space keys
- Total keypress count during the game
- Duration of the game
- Typo ratio

# TV
- Power status (estimated by its IMCP ping)

# Weather
- Monitored by built-in Zabbix OpenWeather template

# whatsuphome.fi

- Monitored through standard Zabbix web scenario
- Access log monitored in real-time via my custom template
- Global availability monitored through Asuswrt-Merlin, Proton VPN and Zabbix web.page.perf
- Global availability traceroute via MTR template
- DNS performance monitoring
- DNS results monitoring

# Zabbix Security Advisories

- Tracked through Zabbix bug tracker security advisories using Jira API, HTTP Agent item type and auto-discovery

---

# Other features

# Generative AI
- Integrated with local GPT4All LLM. Zabbix is able to comment about the alerts in any way I like.
- Sister site generativeai.whatsuphome.fi 100% generated by GPT4All

# Blender 3D software integration
- Custom Python scripts call Blender API and change alerting objects in scene to be red

# Star Wars xscreensaver module integration
- Send Zabbix alerts over Real-time export functionality to another laptop, which then parses the JSON to text, the text then used by the xscreensaver module

# IoT remote integration
- Send events to Zabbix using a remote

# Take screenshot of websites
- Selenium scripts can take screenshots of website when they alert, or anytime from a Zabbix context menu

# Netbox integration
- Zabbix can populate bits and pieces of its inventory based on data that is in Netbox

# Play rock-paper-scissors
- Using Zabbix 7.0 new Browser item type, play rock-paper-scissors against a PHP script at whatsuphome.fi

# Fairy tale alert template
- What's a better way to put your baby to sleep than read her a different kind of fairy tale?

# Zabbix 7.0 custom widgets
- For now, copied the one we did do during Zabbix Summit 2023 custom widget workshop, allowing to filter alerts by clicking on a custom navigator panel.

# Zabbix HA cluster
- There's a risk of rolling blackouts in Finland this winter, so my laptop acts as a standby Zabbix server, ready to kick in if the power fails and my Raspberry Pi 4 goes down. Implemented using the standard Zabbix HA feature.

