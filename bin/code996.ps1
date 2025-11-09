#!/usr/bin/env pwsh

<#
.DESCRIPTION
用于统计 Git 项目的 commit 时间分布，进而推导出这个项目的编码工作强度的脚本。
不支持 Windows PowerShell 及 PowerShell 6，仅支持 PowerShell 7 及更高版本！
.EXAMPLE
./code996.ps1 "2022-1-1" -Author lc6464
.EXAMPLE
./code996.ps1 "2022-1-1"
.EXAMPLE
./code996.ps1 -EndTime "2022-7-13"
.EXAMPLE
./code996.ps1 "2022-1-1" "2022-1-31"
.PARAMETER StartDate
统计数据的开始日期（默认为今年的第一天）。
.PARAMETER EndDate
统计数据的结束日期（默认为今天）。
.PARAMETER Author
统计数据的作者（默认为所有提交者）。
#>
param([DateTime] $StartDate, [DateTime] $EndDate, [string] $Author)

if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host "此脚本不支持 Windows PowerShell 及 PowerShell 6，请使用 PowerShell 7 或更高版本！"
} else {
    function GetGitData {
        param([string] $Format)
        $builder = [Text.StringBuilder]::new()
        $output = [System.Collections.Generic.List[string]]::new()
        $outputRaw = git log --author=$Author --date=format:$Format --after=$StartDateStr --before=$EndDateStr | Select-String "^Date:   (\d\d?)$"
        foreach ($one in $outputRaw) {
            $output.Add($one.Matches.Groups[1].Value)
        }
        $groups = $output | group
        foreach ($one in $groups) {
            $_ = $builder.Append($one.Count.ToString() + "_" + ($Format -eq "%H" ? $one.Name.ToString().PadLeft(2, '0') : $one.Name.ToString()) + ",")
        }
        if ($builder.Length -eq 0) {
            Write-Output $null
        } else {
            $builder.Length -= 1
            Write-Output $builder.ToString()
        }
    }



    $StartDateStr = ($StartDate ?? [DateTime]::new((date).Year - 1, 1, 1)).ToString("yyyy-MM-dd")
    $EndDateStr = ($EndDate ?? (date)).ToString("yyyy-MM-dd")

    if ($StartDate -gt $EndDate) {
        Write-Host "开始日期须早于结束日期！"
    } else {
        $outputByDay = GetGitData %u

        $outputByHour = GetGitData %H

        $result = $StartDateStr + "_$EndDateStr&week=$outputByDay&hour=$outputByHour"

        # url
        $GithubUrl = "https://hellodigua.github.io/code996/#/result?time=$result"
        $VercelUrl = "https://code996.vercel.app/#/result?time=$result"


        Write-Host "复制以下 URL 以查看可视化分析结果："
        Write-Host $VercelUrl
        Write-Host ""
        Write-Host "也可以访问以下镜像站点链接："
        Write-Host "GitHub Pages:"
        Write-Host "$GitHubUrl"
        Write-Host ""

        Start-Process $VercelUrl
    }
}