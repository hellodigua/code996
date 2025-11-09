#!/usr/bin/env bash

Help()
{
   echo "你也可以使用自定义参数进行指定查询"
   echo
   echo "格式: bash $0 [2022-01-01] [2022-04-04] [author]"
   echo "示例: bash code996.sh 2022-01-01 2022-12-31 digua"
   echo "参数:"
   echo "1st     分析的起始时间."
   echo "2nd     分析的结束时间."
   echo "3rd     指定提交用户，可以是 name 或 email."
   echo
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


# should modify by day format %a or %A
# day_sorted=('Monday' 'Tuesday' 'Wednesday' 'Thursday' 'Friday' 'Saturday' 'Sunday')
# day_sorted=('Mon' 'Tue' 'Wed' 'Thu' 'Fri' 'Sat' 'Sun')

RED='\033[1;91m'
NC='\033[0m' # No Color

echo -e "${RED}统计时间范围：$time_start 至 $time_end"

for i in "${by_day_output[@]}"
    do
        echo
        echo -e "${NC}一周七天 commit 分布${RED}"
        echo -e "  总提交次数 星期\n$i"|column -t
        by_day_result=`echo "$i"|sed -E 's/^ +//g'|sed "s/ /_/g"|tr '\n' ','`
    done


for i in "${by_hour_output[@]}"
    do
        echo
        echo -e "${NC}24小时 commit 分布${RED}"
        echo -e "  总提交次数 小时\n$i"|column -t
        by_hour_result=`echo "$i"|sed -E 's/^ +//g'|sed "s/ /_/g"|tr '\n' ','`
    done


by_day_result=`echo "$by_day_result"|sed -E 's/,$//g'`

by_hour_result=`echo "$by_hour_result"|sed -E 's/,$//g'`


result=$time_start"_"$time_end"&week="$by_day_result"&hour="$by_hour_result

# url
github_url="https://hellodigua.github.io/code996/#/result?time=$result"
vercel_url="https://code996.vercel.app/#/result?time=$result"

echo
echo -e "${NC}复制以下url以查看可视化分析结果:"
echo -e "${RED}$github_url"
echo -e "${NC}"
echo -e "${NC}若 GitHub 访问过慢，也可以访问以下镜像链接:"
echo -e "${NC}Vercel节点:"
echo -e "${RED}$vercel_url"
echo -e "${NC}"

$open_url "$github_url"
