+++
date = "2015-09-10T19:51:38Z"
title = "Arch Linux install cheat sheet"

+++

Arch Linux installation instruction for the impatient.

# Partition

```sh

fdisk /dev/d #sda all disk in my case.

#15 GB partition.
Command (m for help):    #type n and press Enter
Partition type: Select (default p): #press Enter
Partition number (1-4, default 1): #press Enter
First sector (2048-209715199, default 2048): #press Enter start in the beginning.
Last sector, +sectors or +size...():  #type +19G and press Enter.


#SWAP 1GB
Command (m for help): #type n and press Enter
Partition type: Select (default p): #press Enter
Partition number (1-4, default 2): #press Enter
First sector (): #press Enter
Last sector, +sectors or +size...():  # +1G press Enter.

#type o *to see if the changes are right.
#type w *to write the changes
```

# Formating and Swap.
```sh
mkfs.ext4 /dev/sda1
mkfs.ext4 /dev/sda2

mkswap /dev/sdaX —> mines is sda2 1GB
swapon /dev/sdaX —> mines is sda2 1GB
```

# Mount and Install.

```sh
cd /mnt
mkdir disk
mount /dev/sda1 disk
pacstrap disk/ base <— take a coffe

```




```sh

#genfstab generates fstab file based on the devices mounted under the mount point.
#assuming you are inside /mnt
genfstab -p disk/ > disk/etc/fstab

```

# Quick config

```sh
#chroot
arch-chroot mnt/ #folder


# echo computer_name > /etc/hostname

#locale configuration
locale-gen

#choose your locale configuration.
echo LANG=your_locale > /etc/locale.conf

#example echo LANG=en_IE.ISO-8859-15@EURO > /etc/locale.conf
#you can uncomment your locale inside the file /etc/locale.conf

#keymap configuration.
echo KEYMAP=es > /etc/vconsole.conf

#root password
passwd

#Installing the bootloader.
pacman -Sy grub  <— install
grub-install --target=i386-pc --recheck --debug /dev/sdx #sda, never sda1..x
grub-mkconfig -o /boot/grub/grub.cfg
```
