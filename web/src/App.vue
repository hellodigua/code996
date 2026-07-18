<template>
  <main v-if="activeReport" class="report-page">
    <GithubCorner />
    <LanguageSwitcher />

    <header class="result-topbar" data-testid="result-topbar">
      <div class="topbar-inner">
        <a class="topbar-button" data-testid="details-link" href="#report-details">
          {{ t('common.details') }}
        </a>
        <h1>#CODE996 Result</h1>
      </div>
    </header>

    <div class="report-shell">
      <section id="report-summary" class="top-result" data-testid="result-summary">
        <p class="hero-repository" data-testid="repo-name">{{ repositoryName }}</p>
        <h2 v-if="!isScoreSuppressed && !isLimitedData" id="score-title">
          {{ t('result.title') }}{{ t('common.colon') }}
        </h2>
        <h2 v-else>{{ t('result.workPattern') }}</h2>

        <div v-if="!isScoreSuppressed && !isLimitedData" class="result-line" aria-labelledby="score-title">
          <div class="score-block">
            <strong class="score" data-testid="score">{{ activeReport.core.index996 }}</strong>
            <p class="rating">{{ t(`rating.${activeReport.core.rating}`) }}</p>
          </div>

          <dl class="result-facts">
            <div>
              <dt>{{ t('result.estimatedWorkTime') }}</dt>
              <dd>{{ workTimeRange }}</dd>
              <small v-if="activeReport.workTime">
                {{ t('result.workTimeConfidence', { sample: activeReport.workTime.sampleCount }) }}
              </small>
            </div>
            <div>
              <dt>{{ t('result.estimatedOvertimeRatio') }}</dt>
              <dd>{{ percentage(activeReport.core.overTimeRatio) }}%</dd>
            </div>
            <div>
              <dt>{{ t('result.totalCommits') }}{{ t('common.colon') }}</dt>
              <dd>{{ activeReport.core.totalCommits }}</dd>
            </div>
            <div>
              <dt>{{ t('result.analysisTime') }}</dt>
              <dd>
                {{
                  t('result.period', { since: activeReport.meta.since || '–', until: activeReport.meta.until || '–' })
                }}
              </dd>
            </div>
          </dl>
        </div>

        <p v-if="!isScoreSuppressed && !isLimitedData" class="index-explanation">
          {{ t('result.indexExplanation') }}
          <a href="#report-details">{{ t('result.seeDetails') }}</a>
        </p>

        <div class="context-tags" aria-label="Analysis context">
          <span>{{ t('result.workPattern') }}</span>
          <span>{{ t('result.version', { version: activeReport.meta.version }) }}</span>
          <span v-if="activeReport.holidayMode">{{ t('result.holidayMode') }}</span>
          <span v-if="activeReport.timezone?.dominantTimezone">
            {{ t('result.timezone', { timezone: activeReport.timezone.dominantTimezone }) }}
          </span>
          <span v-if="activeReport.meta.options.self">{{ t('result.selfOnly') }}</span>
        </div>
      </section>

      <section v-if="isLimitedData" class="open-source-notice limited-data" data-testid="limited-data">
        <p class="section-kicker">LIMITED DATA</p>
        <h2>{{ t('result.limitedTitle') }}</h2>
        <p>{{ t('result.limitedBody') }}</p>
      </section>

      <section v-else-if="isScoreSuppressed" class="open-source-notice" data-testid="open-source-notice">
        <p class="section-kicker">
          {{ isOpenSource ? 'OPEN SOURCE' : 'MIXED PROJECTS' }} /
          {{ t('common.confidence', { value: activeReport.project?.confidence || 0 }) }}
        </p>
        <h2>{{ t(isOpenSource ? 'result.openSourceTitle' : 'result.mixedOpenSourceTitle') }}</h2>
        <p>{{ t(isOpenSource ? 'result.openSourceBody' : 'result.mixedOpenSourceBody') }}</p>
      </section>

      <DiagnosticInsights v-if="!isScoreSuppressed && !isLimitedData" id="report-details" :report="activeReport" />

      <div class="report-stack" data-testid="context-evidence-stack">
        <ClassificationEvidence :report="activeReport" />
        <TimezoneEvidence :report="activeReport" />
      </div>

      <section v-if="activeReport.multiRepo" class="report-section multi-repo-section" data-testid="multi-repo">
        <div class="section-heading">
          <div>
            <p class="section-kicker">REPOSITORY MATRIX</p>
            <h2>{{ t('result.multiRepoTitle') }}</h2>
          </div>
          <p>{{ t('result.multiRepoDescription') }}</p>
        </div>
        <div class="table-scroll">
          <table class="repo-table">
            <thead>
              <tr>
                <th>{{ t('result.repository') }}</th>
                <th>{{ t('result.status') }}</th>
                <th>{{ t('result.projectType') }}</th>
                <th>{{ t('result.index996') }}</th>
                <th>{{ t('result.overtimeRatio') }}</th>
                <th>{{ t('result.totalCommits') }}</th>
                <th>{{ t('result.contributors') }}</th>
                <th>{{ t('details.repository.firstCommit') }}</th>
                <th>{{ t('details.repository.lastCommit') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="repo in activeReport.multiRepo.repos"
                :key="repo.path"
                :data-testid="`repo-${repo.name}`"
                :class="{ 'is-failed': repo.status === 'failed' }"
              >
                <td>
                  <strong>{{ repo.name }}</strong>
                  <small v-if="repo.error" class="repo-error">{{ repo.error }}</small>
                </td>
                <td>
                  <span class="status-badge" :class="`is-${repo.status}`">
                    {{ t(`status.${repo.status}`) }}
                  </span>
                </td>
                <td>{{ repo.project ? t(`projectType.${repo.project.type}`) : '–' }}</td>
                <td class="repo-score">
                  <template v-if="repo.status === 'success' && repo.project?.type === 'open_source'">
                    {{ t('result.openSourceNotRated') }}
                  </template>
                  <template v-else>{{ repo.core?.index996 ?? '–' }}</template>
                </td>
                <td>{{ repo.core ? `${percentage(repo.core.overTimeRatio)}%` : '–' }}</td>
                <td>{{ repo.totalCommits }}</td>
                <td>{{ repo.contributors ?? '–' }}</td>
                <td>{{ repo.firstCommitDate ?? '–' }}</td>
                <td>{{ repo.lastCommitDate ?? '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="hourlyChartData.length" class="report-section chart-card timeline-section">
        <div class="section-heading">
          <div>
            <p class="section-kicker">00:00 — 24:00</p>
            <h2>{{ t('result.timelineTitle') }}</h2>
          </div>
          <p>{{ t('result.timelineDescription') }}</p>
        </div>
        <BarChart :data="hourlyChartData" :label="t('result.hourDistribution')" wide />
      </section>

      <section v-if="weekdayChartData.length || weekdayOvertimeChartData.length" class="report-grid rhythm-grid">
        <article v-if="weekdayChartData.length" class="report-section chart-card">
          <p class="section-kicker">MON — SUN</p>
          <h2>{{ t('result.weekdayTitle') }}</h2>
          <BarChart :data="weekdayChartData" :label="t('result.dayDistribution')" />
        </article>

        <article
          v-if="activeReport.weekdayOvertime && weekdayOvertimeChartData.length"
          class="report-section chart-card overtime-card"
        >
          <p class="section-kicker">AFTER HOURS</p>
          <h2>{{ t('result.weekdayOvertime') }}</h2>
          <p v-if="activeReport.weekdayOvertime.peakDay" class="card-note">
            {{ t('result.peakDay', { day: t(`weekday.${activeReport.weekdayOvertime.peakDay}`) }) }}
          </p>
          <BarChart :data="weekdayOvertimeChartData" :label="t('result.weekdayOvertime')" />
        </article>
      </section>

      <section
        v-if="activeReport.weekendOvertime || activeReport.lateNight"
        class="report-section overtime-analysis-section"
        data-testid="overtime-analysis"
      >
        <div class="section-heading">
          <div>
            <p class="section-kicker">OVERTIME EVIDENCE</p>
            <h2>{{ t('result.overtimeAnalysisTitle') }}</h2>
          </div>
          <p>{{ t('result.overtimeAnalysisDescription') }}</p>
        </div>

        <div class="team-analysis-grid overtime-summary-grid">
          <article v-if="activeReport.weekendOvertime" class="ledger-card evidence-card">
            <p class="section-kicker">SAT / SUN</p>
            <h3>{{ t('result.weekendOvertime') }}</h3>
            <dl class="compact-ledger overtime-compact-table">
              <div>
                <dt>{{ t('result.saturday') }}</dt>
                <dd>{{ activeReport.weekendOvertime.saturdayDays }}</dd>
              </div>
              <div>
                <dt>{{ t('result.sunday') }}</dt>
                <dd>{{ activeReport.weekendOvertime.sundayDays }}</dd>
              </div>
              <div>
                <dt>{{ t('result.realOvertime') }}</dt>
                <dd>{{ activeReport.weekendOvertime.realOvertimeDays }}</dd>
              </div>
              <div>
                <dt>{{ t('result.casualFix') }}</dt>
                <dd>{{ activeReport.weekendOvertime.casualFixDays }}</dd>
              </div>
            </dl>
            <p class="card-note">
              {{
                t('details.overtime.sustainedRatio', {
                  value: percentage(weekendSustainedRatio),
                })
              }}
            </p>
          </article>

          <article v-if="activeReport.lateNight" class="ledger-card evidence-card">
            <p class="section-kicker">21:00 — 06:00</p>
            <h3>{{ t('result.lateNight') }}</h3>
            <dl class="compact-ledger overtime-compact-table">
              <div>
                <dt>
                  <span>{{ t('result.evening') }}</span>
                  <small>{{ lateNightFrequency(activeReport.lateNight.evening) }}</small>
                </dt>
                <dd>{{ activeReport.lateNight.evening }}</dd>
              </div>
              <div>
                <dt>
                  <span>{{ t('result.after21') }}</span>
                  <small>{{ lateNightFrequency(activeReport.lateNight.lateNight) }}</small>
                </dt>
                <dd>{{ activeReport.lateNight.lateNight }}</dd>
              </div>
              <div>
                <dt>
                  <span>{{ t('result.midnight') }}</span>
                  <small>{{ lateNightFrequency(activeReport.lateNight.midnight) }}</small>
                </dt>
                <dd>{{ activeReport.lateNight.midnight }}</dd>
              </div>
              <div>
                <dt>
                  <span>{{ t('result.dawn') }}</span>
                  <small>{{ lateNightFrequency(activeReport.lateNight.dawn) }}</small>
                </dt>
                <dd>{{ activeReport.lateNight.dawn }}</dd>
              </div>
            </dl>
            <p class="card-note">
              {{ t('result.midnightDays') }} {{ activeReport.lateNight.midnightDays }} ·
              {{ t('result.midnightRate', { value: percentage(activeReport.lateNight.midnightRate) }) }}
            </p>
          </article>
        </div>
      </section>

      <TrendAnalysis v-if="activeReport.trend?.monthlyData.length" :trend="activeReport.trend" />

      <TeamAnalysis v-if="activeReport.team?.contributors.length" :team="activeReport.team" />

      <footer class="report-footer" data-testid="report-notices">
        <div class="report-footer-heading">
          <p class="section-kicker">NOTICE</p>
        </div>
        <ul class="report-notice-list">
          <li class="notice-privacy">
            <span
              >{{ t('notices.privacyLabel') }}<strong>{{ t('notices.privacy') }}</strong></span
            >
          </li>
          <li>{{ t('notices.limit') }}</li>
          <li>{{ t('notices.usage') }}</li>
        </ul>
        <ReportCommandGuide />
        <div class="report-footer-meta">
          <p>
            {{ t('notices.github') }}
            <a href="https://github.com/hellodigua/code996" target="_blank" rel="noreferrer">
              https://github.com/hellodigua/code996
            </a>
          </p>
          <p>code996 · MIT License</p>
        </div>
      </footer>
    </div>
  </main>

  <main v-else class="empty-report">
    <p class="eyebrow">code996 / {{ t('common.localReport') }}</p>
    <h1>{{ t('result.missingTitle') }}</h1>
    <p>{{ t('result.missingBody') }}</p>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportData } from '../../src/report/report-data'
import BarChart from '@/components/charts/BarChart.vue'
import ClassificationEvidence from '@/components/ClassificationEvidence.vue'
import DiagnosticInsights from '@/components/DiagnosticInsights.vue'
import GithubCorner from '@/components/GithubCorner.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import ReportCommandGuide from '@/components/ReportCommandGuide.vue'
import TeamAnalysis from '@/components/TeamAnalysis.vue'
import TimezoneEvidence from '@/components/TimezoneEvidence.vue'
import TrendAnalysis from '@/components/TrendAnalysis.vue'
import { useWebI18n } from '@/i18n'
import { formatClock, getRepositoryName, percentage } from '@/report/formatters'

const props = defineProps<{ report?: ReportData }>()
const activeReport = computed(() => props.report || window.__CODE996_REPORT__ || null)
const { setLocale, t } = useWebI18n()

if (activeReport.value) setLocale(activeReport.value.meta.locale)

const repositoryName = computed(() => {
  if (!activeReport.value) return 'code996'
  const repoCount = activeReport.value.multiRepo?.repos.length
  return repoCount ? t('result.repositoryCount', { count: repoCount }) : getRepositoryName(activeReport.value)
})
const isOpenSource = computed(() => activeReport.value?.project?.type === 'open_source')
const containsOpenSourceRepository = computed(
  () =>
    activeReport.value?.multiRepo?.repos.some(
      (repo) => repo.status === 'success' && repo.project?.type === 'open_source'
    ) ?? false
)
const isScoreSuppressed = computed(() => isOpenSource.value || containsOpenSourceRepository.value)
const isLimitedData = computed(() => activeReport.value !== null && activeReport.value.core.totalCommits < 50)
const workTimeRange = computed(() => {
  const workTime = activeReport.value?.workTime
  return workTime ? `${formatClock(workTime.startHour)}–${formatClock(workTime.endHour)}` : t('common.unavailable')
})
const weekendSustainedRatio = computed(() => {
  const weekend = activeReport.value?.weekendOvertime
  if (!weekend) return 0
  const total = weekend.realOvertimeDays + weekend.casualFixDays
  return total ? (weekend.realOvertimeDays / total) * 100 : 0
})
const weekdayChartData = computed(() =>
  (activeReport.value?.weekdayDistribution || []).map((item) => ({ time: t(`weekday.${item.day}`), count: item.count }))
)
const hourlyChartData = computed(() =>
  (activeReport.value?.hourlyDistribution || []).map((item) => ({ time: item.hour, count: item.count }))
)
const weekdayOvertimeChartData = computed(() => {
  const overtime = activeReport.value?.weekdayOvertime
  if (!overtime) return []
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => ({
    time: t(`weekday.${day}`),
    count: overtime[day as keyof Pick<typeof overtime, 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'>],
  }))
})

function lateNightFrequency(count: number): string {
  const analysis = activeReport.value?.lateNight
  if (!analysis) return ''
  const weekly = analysis.totalWeeks ? count / analysis.totalWeeks : 0
  const monthly = analysis.totalMonths ? count / analysis.totalMonths : 0
  return t('details.overtime.frequency', { weekly: weekly.toFixed(1), monthly: monthly.toFixed(1) })
}
</script>
