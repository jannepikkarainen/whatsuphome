#!/usr/bin/python3
import sys
import re
from selenium import webdriver
from selenium.webdriver.common.by import By

plainName = sys.argv[1]
plainName = plainName.replace("https://","")
plainName = plainName.strip("/")

fireFoxOptions = webdriver.FirefoxOptions()
fireFoxOptions.set_headless()
driver = webdriver.Firefox(firefox_options=fireFoxOptions)

driver.get("https://" + plainName)
driver.save_screenshot("/usr/share/zabbix/assets/webtest-screenshots/" + plainName + ".png")
driver.quit()
