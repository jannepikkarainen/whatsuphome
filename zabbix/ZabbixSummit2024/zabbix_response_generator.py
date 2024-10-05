from gpt4all import GPT4All
import argparse

parser = argparse.ArgumentParser(description='Pass question to GPT4All')
parser.add_argument('-q', '--question')
args=parser.parse_args()

model = GPT4All('Meta-Llama-3-8B-Instruct.Q4_0.gguf')
system_template = 'A chat between a curious user and an artificial intelligence assistant.'
# many models use triple hash '###' for keywords, Vicunas are simpler:
prompt_template = 'USER: {0}\nASSISTANT: '
with model.chat_session(system_template, prompt_template):
    response1 = model.generate(args.question, max_tokens=200)
    print(response1)
