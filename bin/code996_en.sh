#!/usr/bin/env bash

Help()
{
   # Display Help
   echo "Hey please give me three param like this!"
   echo
   echo "Syntax: bash $0 [2022-01-01] [2022-04-04] [author]"
   echo "example: bash code996.sh 2022-01-01 2022-12-31 digua"
   echo "options:"
   echo "1st param     Calculate from time."
   echo "2nd param     Calculate to time."
   echo "3rd param     Calculate by committer."
   echo
   echo "You can be inspired by 'git log --help' to get more detail."
}

OS_DETECT()
{
   # Detect OS
    case "$(uname -s)" in

    Linux)
        # echo 'Linux'
        open_url="xdg-open"
        ;;

    Darwin)
        # echo 'macOS'
        open_url="open"
        ;;

    CYGWIN*|MINGW32*|MSYS*|MINGW*)
        # echo 'Windows'
        open_url="start"
        ;;

    *)
        echo 'Other OS'
        echo "trying to use xdg-open to open the url"
        open_url="xdg-open"
        ;;
    esac

}
OS_DETECT


time_start=$1


if [ "$1" == "--help" ]
    then
        Help
        exit 0
elif [ "$1" == "-h" ]
    then
        Help
        exit 0
fi

if [ -z $1 ]
    then
        time_start="2022-01-01"
fi

time_end=$2
if [ -z $2 ]
    then
        time_end=$(date "+%Y-%m-%d")
fi

author=$3
if [ -z $3 ]
    then
        author=""
fi


by_day_output=`git -C "$PWD" log --author=$author --date=format:%u --after="$time_start" --before="$time_end" |grep "Date:"|awk '{print $2}'|sort|uniq -c`

by_hour_output=`git -C "$PWD" log --author=$author --date=format:%H --after="$time_start" --before="$time_end" |grep "Date:"|awk '{print $2}'|sort|uniq -c`

for i in "${by_day_output[@]}"
    do
        by_day_result=`echo "$i"|sed -E 's/^ +//g'|sed 's/ /_/g'|tr '\n' ','`

    done

RED='\033[1;91m'
NC='\033[0m' # No Color

echo -e "${RED}Calculation time range：$time_start to $time_end"

for i in "${by_day_output[@]}"
    do
        echo
        # echo -e "${RED}By Day:"
        echo -e "${NC}Weekly commit distribution${RED}"
        echo -e "  Statistics Weekly\n$i"|column -t
        by_day_result=`echo "$i"|sed -E 's/^ +//g'|sed "s/ /_/g"|tr '\n' ','`
    done


for i in "${by_hour_output[@]}"
    do
        echo
        echo -e "${NC}24 Hours commit distribution${RED}"
        echo -e "  Statistics Hours\n$i"|column -t
        by_hour_result=`echo "$i"|sed -E 's/^ +//g'|sed "s/ /_/g"|tr '\n' ','`
    done


by_day_result=`echo "$by_day_result"|sed -E 's/,$//g'`

by_hour_result=`echo "$by_hour_result"|sed -E 's/,$//g'`


result=$time_start"_"$time_end"&week="$by_day_result"&hour="$by_hour_result

# default site - English routes
github_url="https://hellodigua.github.io/code996/#/en/result?time=$result"
vercel_url="https://code996.vercel.app/#/en/result?time=$result"

echo
echo -e "${NC}You can manually click the url below when you want to see the result if something goes wrong："
echo -e "${RED}$github_url"
echo -e "${NC}"
echo -e "${NC}vercel server："
echo -e "${RED}$vercel_url"
echo -e "${NC}"

$open_url "$github_url"
