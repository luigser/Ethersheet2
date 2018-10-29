#!/usr/bin/env bash
BCOLOR=3
ABSOLUTE_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
DBPWD="$1"

#define functions
createUser()
{
    tput bold
    tput setaf ${BCOLOR}
    echo "1. User Management - Create ethersheet user\r\r"
    tput sgr0
    #Commands
    useradd --create-home ethersheet
    #su - ethersheet
    cd /home/ethersheet
    tput setaf 2
    echo "done"
}

cloneRepository()
{
    tput bold
    tput setaf ${BCOLOR}
    echo "2. Clone Ethersheet project in the user directory\r\r"
    tput sgr0
    #Commands
    cd /home/ethersheet
    #curl https://raw.githubusercontent.com/ethersheet-collective/EtherSheet/master/dev_install.sh | bash
    git clone https://github.com/luigser/Ethersheet2.git ./
    chown -R ethersheet:ethersheet ethersheet
    cd ethersheet/
    #sh dev_install.sh
    #npm install module
    npm install
    npm install csv@0.2.0
    npm install csv-sniffer
    npm install express@4
    npm install body-parser
    npm install cookie-parser
    npm install cookie-session
    npm install formidable
    npm install compression
    npm install cluster
    npm install http-proxy
    npm install url
    npm install adm-zip
    tput setaf 2
    echo "done"
}

createDatabase()
{
    tput bold
    tput setaf ${BCOLOR}
    echo "3. Create database\r\r"
    tput sgr0
    #Commands
    cd ${ABSOLUTE_PATH}
    mysql -u root -p${DBPWD} -e "SET PASSWORD FOR 'ethersheet'@'localhost' = PASSWORD('ethersheet');"
    mysql -u root -p${DBPWD} < db.sql
    tput setaf 2
    echo "done"
}

installService()
{
    tput bold
    tput setaf ${BCOLOR}
    echo "6. Install Ethersheet service\r\r"
    tput sgr0
    #Commands
    cd ${ABSOLUTE_PATH}
    cp ethersheet.conf /etc/init
    mkdir /var/log/ethersheet
    chown -R ethersheet /var/log/ethersheet
    tput setaf 2
    echo "done"
}

startService()
{
    tput bold
    tput setaf ${BCOLOR}
    echo "7. Start ethersheet service\r\r"
    tput sgr0
    #Commands
    service ethersheet start
    tput setaf 2
    echo "done"
}

settingSudoUser(){
    tput bold
    tput setaf ${BCOLOR}
    echo "10. Make www-data able to start ethersheet service\r\r"
    tput sgr0
    #Commands
    #IP = "$(ifconfig | grep -A 1 'eth0' | tail -1 | cut -d ':' -f 2 | cut -d ' ' -f 1)"
    IP="$(hostname -I | cut -d' ' -f1)"
    if grep -q "Host_Alias LOCAL=${IP}" /etc/sudoers ;
        then
           tput setaf 3
           echo "Host_Alias already created"
        else
           echo "Host_Alias LOCAL=${IP}" >> /etc/sudoers
    fi
    if grep -q "www-data       LOCAL=NOPASSWD:/usr/bin/service ethersheet" /etc/sudoers ;
        then
           tput setaf 3
           echo "Start/Stop rules already created"
        else
           echo "www-data       LOCAL=NOPASSWD:/usr/bin/service ethersheet start" >> /etc/sudoers
           echo "www-data       LOCAL=NOPASSWD:/usr/bin/service ethersheet stop" >> /etc/sudoers
    fi
    tput setaf 2
    echo "done"
}

exitProg()
{
    tput sgr0
}

#main
# clear the screen
tput clear

# Move cursor to screen location X,Y (top left is 0,0)
tput cup 3 15
# Set a foreground colour using ANSI escape
tput bold
tput setaf ${BCOLOR}
echo "ISISLab"
tput sgr0

tput cup 5 17
# Set reverse video mode
tput rev
tput setaf ${BCOLOR}
tput bold
echo "I N S T A L L  - E T H E R S H E E T  S E R V I C E"
tput cup 6 17
echo "     this script must be executed as root      "
tput sgr0

tput cup 7 15
echo "1.  All"

tput cup 8 15
echo "2.  User Management - Create etherpad user"

tput cup 9 15
echo "3.  Clone Ethersheet project in the user directory"

tput cup 10 15
echo "4.  Create database"

tput cup 12 15
echo "5.  Install EtherSheet service"

tput cup 13 15
echo "6.  Make www-data able to start EtherSheet service"

# Set bold mode
tput bold
tput cup 14 15
read -p "Enter your choice [1-6] " choice

case $choice in
   1) createUser
      cloneRepository
      createDatabase
      installService
      settingSudoUser
      startService
      ;;
   2) createUser ;;
   3) cloneRepository ;;
   4) createDatabase ;;
   5) installService ;;
   6) settingSudoUser ;;
esac

exitProg


