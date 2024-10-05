#!/usr/bin/python3
from zabbix_utils import ZabbixAPI
from gpt4all import GPT4All
import argparse

ZABBIX_SERVER = "https://your.server"
zapi = ZabbixAPI(ZABBIX_SERVER)
zapi.login(token='your.token')

history = zapi.history.get(
        history=2,
        output='extend',
        itemids='44501',
        sortfield='clock',
        sortorder='DESC',
        limit=10 
        )

# Print a list containing only "tripped" triggers
payload = ""
for t in history:
       payload += "{}".format(
                t["value"]
                )

print (payload)

parser = argparse.ArgumentParser(description='Pass question to GPT4All')
parser.add_argument('-q', '--question')
args=parser.parse_args()

model = GPT4All('Meta-Llama-3.1-8B-Instruct-128k-Q4_0.gguf', n_threads=6, n_ctx=16384)
system_template = 'A chat between a curious user and an artificial intelligence assistant.'

# many models use triple hash '###' for keywords, Vicunas are simpler:
prompt_template = 'USER: {0}\nASSISTANT: '
with model.chat_session(system_template, prompt_template):
    response1 = model.generate(args.question+payload, max_tokens=1000)
    print(response1)
