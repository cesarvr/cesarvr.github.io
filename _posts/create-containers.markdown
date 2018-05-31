---
date: "2018-05-22"
title: "How Linux Containers Works"
layout: post
---

# How Linux Containers Works

Containers is one of the hottest technologies at the moment, but sometimes they are misunderstood, so inspired by the [talk](https://www.ustream.tv/embed/recorded/102859668) of [Liz Rice](https://twitter.com/lizrice) about the technology behind containers. I decided to write a post about the steps involved in the container creation in the hope that help people create maybe a better definition of what a container is.


## Linux process

A process in simple terms is just the instantiation of binary code usually a program into the memory.

Basically you have some code, in this case I'll use C++.

```c++
#include <iostream>
using namespace std;

int main(int argc, char* argv[]){
  cout << "Hello World" << endl;
  return 0;
}
```

You compile this code into a binary, I'll choose an original name, let's call it container.

```sh
g++ container.cc -o container  
```

Now let's create the process.

```sh
./container   
```

The process will get instantiated, execute the instruction to pass some words to the Linux kernel and this will outputted into the console and exit.

```sh
# Hello World!
```

## Child processes

One of the features of Unix based systems is that process can have children's which is a one way to achieve multitasking, in this case we are going to extend our program to run a simple child process.

```c++
template<typename F>
void createChildProcess(F &&action, int flags) {
  auto pid = clone(action, allocStackMemory(), flags, 0);

  #...
}

int main(int argc, char* argv[]){
  createChildProcess( [](void *args) -> int {
    cout << " Hello from a new process: children" << endl;
  }, SIGCHLD);

  return 0;
}
```

Here we just created a function (createChildProcess) that create child processes, you pass an anonymous function (lambda) and it will execute the code in another process, simple as that and wait until it finish.

If you re-run this program you'll get.

```sh
./container
# Hello from a new process: children
```

## Fake it until you make it
