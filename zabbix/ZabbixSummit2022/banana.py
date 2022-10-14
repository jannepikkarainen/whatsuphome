import cv2
img = cv2.imread('/home/pi/banana.png')
hsv_frame = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

pixel_center = hsv_frame[400, 600]
hue_value = pixel_center[0]

color = "Undefined"
if hue_value < 5:
  color = "RED"
elif hue_value < 22:
  color = "ORANGE"
elif hue_value < 33:
  color = "YELLOW"
elif hue_value < 78:
  color = "GREEN"
elif hue_value < 131:
  color = "BLUE"
elif hue_value < 170:
  color = "VIOLET"
else:
  color = "ZABBIX"

print(color);
