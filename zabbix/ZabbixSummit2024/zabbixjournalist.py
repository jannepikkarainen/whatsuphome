#!/usr/bin/python3
from zabbix_utils import ZabbixAPI
from gpt4all import GPT4All
import argparse

ZABBIX_SERVER = "https://your.server/"
zapi = ZabbixAPI(ZABBIX_SERVER)
zapi.login(token='youraccesstoken')

# Get a list of all issues (AKA tripped triggers)
triggers = zapi.trigger.get(
    only_true=1,
    skipDependent=1,
    monitored=1,
    active=1,
    output="extend",
    expandDescription=1,
    selectHosts=["host"],
)

# Do another query to find out which issues are Unacknowledged
unack_triggers = zapi.trigger.get(
    only_true=1,
    skipDependent=1,
    monitored=1,
    active=1,
    output="extend",
    expandDescription=1,
    selectHosts=["host"],
    withLastEventUnacknowledged=1,
)
unack_trigger_ids = [t["triggerid"] for t in unack_triggers]
for t in triggers:
    t["unacknowledged"] = True if t["triggerid"] in unack_trigger_ids else False

# Print a list containing only "tripped" triggers
alerts = ""
for t in triggers:
    if int(t["value"]) == 1:
       alerts += "{} - {} {}".format(
                t["hosts"][0]["host"],
                t["description"],
                "(Unack)" if t["unacknowledged"] else "",
                )



parser = argparse.ArgumentParser(description='Pass question to GPT4All')
parser.add_argument('-q', '--question')
args=parser.parse_args()

model = GPT4All('Nous-Hermes-2-Mistral-7B-DPO.Q4_0.gguf')
system_template = 'A chat between a curious user and an artificial intelligence assistant.'

# many models use triple hash '###' for keywords, Vicunas are simpler:
prompt_template = 'USER: {0}\nASSISTANT: '
with model.chat_session(system_template, prompt_template):
    response1 = model.generate(args.question+alerts, max_tokens=1000)
    print(response1)
