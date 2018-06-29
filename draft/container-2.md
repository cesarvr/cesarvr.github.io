#### Isolating File System

The objective now is to isolate the access to the files our process can access, to achieve that we are going to change the root folder of our cloned process by using the good old ```chroot``` but this time instead of the command we are going to use the equivalent system call.  


#### Preparing The Root Folder
We can change the root to an empty folder but if we do that we are going to loose the tools we are using so far to inspect the quality of our container, to avoid this we need to get some Linux base folder that include the necessary tools. I'll choose [Alpine Linux](https://github.com/yobasystems/alpine) because is very minimal is about 2MB compressed and has essential tools.

Just grab the base [install](alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz). 

```
mkdir root && cd root
curl -Ol http://nl.alpinelinux.org/alpine/v3.7/releases/
```

Uncompress into a folder called ```root``` at the same level of our binary.

```
x86_64/alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
tar -xvf alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
```



#### Changing The Root Folder

The changes we need to do are fairly simple, we are going to make a call to **chroot** passing the ```root``` folder containing basic folder structure.

```
 chroot("./root"); //point to your downloaded base folder.
```

We change the process directory to the new rooted location ```chdir(/)```.
```c++
 chdir("/"); // point to root folder /.
```

We group this two behaviors into a single function. 

```c++
void setupFileSystem(){
  chroot("./root");
  chdir("/");
} 

```

Once migrated to the new root folder we need to tell our shell where to find the tools we need (ls, ps, clear, etc..) and information about the screen, also we move all this functionality to its own function. 

```c++ 
void setupEnvVars() {
  clearenv();
  setenv("TERM", "xterm-256color", 0);
  setenv("PATH", "/bin/:/sbin/:usr/bin:/usr/sbin", 0);
}
```

After we change root folder now we need to pass more information to the system call in charge loading the program, so we group this logic also. 

```c++ 
int run(const char *name) {
  char *_args[] = {(char *)name, (char *)0 };
  execvp(name, _args);
}
```

The code for the child process now looks like this: 

```cpp
void setupEnvVars() {
  clearenv();
  setenv("TERM", "xterm-256color", 0);
  setenv("PATH", "/bin/:/sbin/:usr/bin:/usr/sbin", 0);
}

void setupFileSystem(){
  chroot("./root");
  chdir("/");
}

int child(void *args) {
  printf("pid: %d\n", getpid());
  setHostName("my-container");
  setupFileSystem();
  setupEnvVars();
  run("/bin/sh"); 
}
```

## Conclusion 

#### Mounting file system into our container

But happiness is not complete yet, if we run our contained process and run ```ps``` look what we found.

```
PID TTY          TIME CMD
```

It seems that we don't have any process running, the problem is that when we change the root folder, we stop using the global ```/proc``` directory and our child process is using the empty one available in the distribution, this directory is the place where Linux mounts the **procfs** pseudo-filesystem.

##### Reusability Lesson

The [procfs](https://en.wikipedia.org/wiki/Procfs) filesystem doesn't represent a part of your disk or any storage at all, Linux follows the Unix principle of "everything is a file", so instead of creating new interfaces to share information they use the folder/files metaphors to communicate information to the user.

##### Mounting Procfs

The system call [mount](http://man7.org/linux/man-pages/man2/mount.2.html) our call will look like this:

```cpp
mount("proc", "/proc", "proc", 0, 0);
```
This method receive the resource we want to mount, the we pass the folder pointing to the ```/proc``` folder and the filesystem type which is ```proc```.  

```cpp
createChild([](void *args) -> int {
      #...
      chdir("/"); // point to root folder /.
      sethostname(hostname.c_str(), hostname.size());

      mount("proc", "/proc", "proc", 0, 0);

      execvp({"/bin/sh"}, {});
  }, CLONE_NEWUTS | CLONE_NEWPID | SIGCHLD);
```

We compile and run our program and then we run ``` ps ```.

```
process created with pid: 8238
current process id: 1
/ # ps
PID   USER     TIME   COMMAND
    1 root       0:00 /bin/sh
    2 root       0:00 ps
```

If we pay close attention we see that this process tree looks unique to our context, this is because now we are noticing the full effect off having assigned to our child process a new process tree as we did above by using the flag ``` CLONE_NEWPID ```.


##### Control Groups
