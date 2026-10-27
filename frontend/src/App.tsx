import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { plannerApi, type Difficulty, type PlannerData, type StudySession, type Subject, type Topic } from './api'
import './App.css'

type View = 'overview' | 'subjects' | 'schedule' | 'quizzes'

const emptyData: PlannerData = { subjects: [], sessions: [], questions: [], dailyStudyHours: 2 }

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'subjects', label: 'My subjects', icon: BookOpen },
  { id: 'schedule', label: 'Study plan', icon: CalendarDays },
  { id: 'quizzes', label: 'Quick quiz', icon: CircleHelp },
]

function dateKey(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en', options).format(new Date(`${date}T12:00:00`))
}

function daysUntil(date: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000))
}

function App() {
  const [data, setData] = useState<PlannerData>(emptyData)
  const [view, setView] = useState<View>('overview')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [showTopicForm, setShowTopicForm] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    plannerApi.getPlanner()
      .then((planner) => { setData(planner); setLoadError(''); setHasLoaded(true) })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Could not connect to the backend'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const selectedSubject = data.subjects.find((subject) => subject.id === selectedSubjectId)
  const allTopics = data.subjects.flatMap((subject) => subject.topics.map((topic) => ({ ...topic, subjectName: subject.name, subjectId: subject.id })))
  const remainingTopics = allTopics.filter((topic) => !topic.completed)
  const completedTopics = allTopics.filter((topic) => topic.completed).length
  const completion = allTopics.length ? Math.round((completedTopics / allTopics.length) * 100) : 0
  const upcomingExams = [...data.subjects].sort((first, second) => first.examDate.localeCompare(second.examDate))
  const today = dateKey(new Date())
  const todaysSessions = data.sessions.filter((session) => session.date === today)
  const completedMinutes = data.sessions.filter((session) => session.completed).reduce((total, session) => total + session.durationMinutes, 0)

  // Highest priority active topics
  const highPriorityTopics = useMemo(() => {
    return [...remainingTopics]
      .sort((a, b) => (b.priorityScore ?? 50) - (a.priorityScore ?? 50))
      .slice(0, 3)
  }, [remainingTopics])

  const filteredSubjects = useMemo(() => data.subjects.filter((subject) => subject.name.toLowerCase().includes(search.toLowerCase())), [data.subjects, search])

  async function persist<T>(operation: () => Promise<T>, successMessage: string): Promise<T | null> {
    setIsSaving(true)
    setLoadError('')
    try {
      const result = await operation()
      const planner = await plannerApi.getPlanner()
      setData(planner)
      setHasLoaded(true)
      setNotice(successMessage)
      return result
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not save your change')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  async function reloadPlanner() {
    setIsLoading(true)
    try {
      setData(await plannerApi.getPlanner())
      setLoadError('')
      setHasLoaded(true)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not connect to the backend')
    } finally {
      setIsLoading(false)
    }
  }

  async function addSubject(name: string, examDate: string) {
    const subject = await persist(() => plannerApi.addSubject(name, examDate), 'Subject added')
    if (!subject) return
    setSelectedSubjectId(subject.id)
    setView('subjects')
    setShowSubjectForm(false)
  }

  async function addTopic(name: string, difficulty: Difficulty, hours: number) {
    if (!selectedSubject) return
    const topic = await persist(() => plannerApi.addTopic(selectedSubject.id, name, difficulty, hours), 'Topic added')
    if (topic) setShowTopicForm(false)
  }

  async function toggleTopic(subjectId: string, topicId: string) {
    const topic = data.subjects.find((subject) => subject.id === subjectId)?.topics.find((item) => item.id === topicId)
    if (topic) await persist(() => plannerApi.setTopicCompleted(topicId, !topic.completed), 'Topic progress saved')
  }

  async function removeSubject(subjectId: string) {
    const removed = await persist(() => plannerApi.removeSubject(subjectId).then(() => true), 'Subject removed')
    if (!removed) return
    setSelectedSubjectId(null)
  }

  async function generatePlan(customPrompt?: string) {
    let sessionCount = 0
    const sessions = await persist(async () => {
      const res = await plannerApi.generateSchedule(customPrompt)
      if (Array.isArray(res)) {
        sessionCount = res.length
        return res
      } else {
        sessionCount = res.sessions.length
        return res.sessions
      }
    }, 'Study plan saved')

    if (!sessions) return
    setView('schedule')
    setNotice(`Scheduled ${sessionCount} study sessions successfully`)
  }

  async function generateAiQuiz(topicId: string, options?: { difficulty?: Difficulty; customPrompt?: string }) {
    const questions = await persist(() => plannerApi.generateAiQuiz(topicId, options), 'Diagnostic quiz questions generated!')
    if (questions) {
      setView('quizzes')
    }
    return questions
  }

  async function toggleSession(sessionId: string) {
    const session = data.sessions.find((item) => item.id === sessionId)
    if (session) await persist(() => plannerApi.setSessionCompleted(sessionId, !session.completed), 'Session progress saved')
  }

  async function addQuestion(topicId: string, prompt: string, options: string[], answer: string, explanation?: string) {
    return persist(() => plannerApi.addQuestion(topicId, prompt, options, answer, explanation), 'Question saved')
  }

  async function removeQuestion(questionId: string) {
    return persist(() => plannerApi.removeQuestion(questionId).then(() => true), 'Question removed')
  }

  async function answerQuestion(questionId: string, selected: string) {
    const result = await plannerApi.answerQuestion(questionId, selected)
    // Reload planner to reflect updated weakness and adaptive schedule
    plannerApi.getPlanner().then(setData).catch(console.error)
    return result
  }

  const activeEngine = data.aiStatus?.engine ?? 'fallback'
  const pageTitle = view === 'overview' ? 'Your learning, in focus.' : navItems.find((item) => item.id === view)?.label ?? 'Study planner'

  return (
    <div className="app-shell" aria-busy={isSaving}>
      <aside className="sidebar">
        <button type="button" className="brand" onClick={() => setView('overview')} aria-label="Studywell overview">
          <span className="brand-mark"><GraduationCap size={20} strokeWidth={2.2} /></span>
          <span>studywell<span className="brand-period">.</span></span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button className={`nav-item ${view === id ? 'active' : ''}`} key={id} onClick={() => { setView(id); setSelectedSubjectId(null) }}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {id === 'subjects' && <span className="nav-count">{data.subjects.length}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><strong>{view === 'overview' ? 'Overview' : pageTitle}</strong></div>
          <div className="topbar-actions">
            <span
              className={`status-dot ${activeEngine === 'api' ? 'dot-green' : 'dot-blue'}`}
              title={activeEngine === 'api' ? 'AI active' : 'Algorithmic planner active'}
            />
            <span className="today-label"><CalendarDays size={15} />{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span>
            <button className="button button-dark button-small" disabled={!hasLoaded || isSaving} onClick={() => setShowSubjectForm(true)}><Plus size={16} /> Add subject</button>
          </div>
        </header>

        <div className="page-content">
          {isLoading && !hasLoaded ? <div className="connection-state">Loading your planner…</div> : !hasLoaded ? <div className="connection-state connection-error"><h2>Could not load your planner</h2><p>{loadError}</p><button className="button button-dark" onClick={() => void reloadPlanner()}>Retry connection</button></div> : <>
          {loadError && <div className="connection-banner" role="alert"><span>{loadError}</span><button className="text-button" onClick={() => void reloadPlanner()}>Retry</button></div>}
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> STUDY PLANNER</div>
              <h1>{pageTitle}</h1>
              <p>{view === 'overview' ? 'Personalized timetable optimized for exam dates, topic difficulty & retrieval practice.' : view === 'subjects' ? 'Manage curriculum subjects, track syllabus progress, and set difficulty levels.' : view === 'schedule' ? 'Chunked study sessions with interleaving and spaced revision intervals.' : 'Diagnostic practice questions to test concept mastery and update learning priorities.'}</p>
            </div>
            {view === 'overview' && <button className="button button-lime" onClick={() => generatePlan()}><CalendarDays size={15} /> Build study plan <ArrowRight size={14} /></button>}
          </section>

          {view === 'overview' && <Overview
            data={data}
            upcomingExams={upcomingExams}
            todaysSessions={todaysSessions}
            remainingTopics={remainingTopics}
            completedTopics={completedTopics}
            completion={completion}
            completedMinutes={completedMinutes}
            highPriorityTopics={highPriorityTopics}
            onView={setView}
            onToggleSession={toggleSession}
            onSelectSubject={(id) => { setSelectedSubjectId(id); setView('subjects') }}
            onAddSubject={() => setShowSubjectForm(true)}
            onGeneratePlan={() => generatePlan()}
          />}

          {view === 'subjects' && <section className="subjects-layout">
            <div className="subject-list-panel">
              <div className="panel-toolbar"><div><h2>Subjects <span className="subtle-count">{data.subjects.length}</span></h2><p>Exam dates and syllabus progress</p></div><button className="icon-button" aria-label="Add subject" title="Add subject" onClick={() => setShowSubjectForm(true)}><Plus size={18} /></button></div>
              <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a subject" /></label>
              <div className="subject-list">{filteredSubjects.map((subject) => {
                const done = subject.topics.filter((topic) => topic.completed).length
                const percent = subject.topics.length ? Math.round((done / subject.topics.length) * 100) : 0
                return <button key={subject.id} className={`subject-list-item ${selectedSubjectId === subject.id ? 'selected' : ''}`} onClick={() => setSelectedSubjectId(subject.id)}><span className="subject-swatch" style={{ background: subject.color }} /><span className="subject-list-main"><strong>{subject.name}</strong><span>{subject.topics.length} topics · exam {formatDate(subject.examDate)}</span><span className="mini-progress"><i style={{ width: `${percent}%`, background: subject.color }} /></span></span><span className="item-percent">{percent}%</span></button>
              })}{filteredSubjects.length === 0 && <div className="empty-search">No subjects match that search.</div>}</div>
              <button className="add-subject-row" onClick={() => setShowSubjectForm(true)}><Plus size={16} /> Add a subject</button>
            </div>
            <div className="subject-detail-panel">{selectedSubject ? <SubjectDetail subject={selectedSubject} onAddTopic={() => setShowTopicForm(true)} onToggleTopic={toggleTopic} onRemove={() => removeSubject(selectedSubject.id)} onGenerateAiQuiz={generateAiQuiz} /> : <div className="detail-empty"><div className="empty-icon"><BookOpen size={22} /></div><h2>Choose a subject</h2><p>Select one from the list to see its topics and progress.</p><button className="button button-outline" onClick={() => setShowSubjectForm(true)}><Plus size={16} /> Add your first subject</button></div>}</div>
          </section>}

          {view === 'schedule' && <Schedule data={data} onGenerate={(prompt) => generatePlan(prompt)} onToggleSession={toggleSession} />}
          {view === 'quizzes' && <Quizzes data={data} onAddQuestion={addQuestion} onRemoveQuestion={removeQuestion} onAnswerQuestion={answerQuestion} onGenerateAiQuiz={generateAiQuiz} />}
          </>}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setSelectedSubjectId(null) }}><Icon size={19} /><span>{label}</span></button>)}</nav>

      {showSubjectForm && <SubjectModal onClose={() => setShowSubjectForm(false)} onSubmit={addSubject} />}
      {showTopicForm && selectedSubject && <TopicModal onClose={() => setShowTopicForm(false)} onSubmit={addTopic} />}
      {notice && <div className="toast" role="status"><CheckCircle2 size={17} />{notice}</div>}
    </div>
  )
}

function Overview({ data, upcomingExams, todaysSessions, remainingTopics, completedTopics, completion, completedMinutes, highPriorityTopics, onView, onToggleSession, onSelectSubject, onAddSubject, onGeneratePlan }: {
  data: PlannerData
  upcomingExams: Subject[]
  todaysSessions: StudySession[]
  remainingTopics: (Topic & { subjectName: string; subjectId: string })[]
  completedTopics: number
  completion: number
  completedMinutes: number
  highPriorityTopics: (Topic & { subjectName: string; subjectId: string })[]
  onView: (view: View) => void
  onToggleSession: (id: string) => void
  onSelectSubject: (id: string) => void
  onAddSubject: () => void
  onGeneratePlan: () => void
}) {
  const sessions = [...todaysSessions].sort((first, second) => first.startTime.localeCompare(second.startTime))
  return <>
    <section className="welcome-band">
      <div className="welcome-copy">
        <div className="welcome-kicker"><Target size={13} /> EXAM PREPARATION & RETENTION</div>
        <h2>Smarter studying, <em>measurable results</em>.</h2>
        <p>{remainingTopics.length ? `${remainingTopics.length} active topics prioritized across ${data.subjects.length} subjects based on exam dates and quiz mastery.` : 'Add a subject and its topics to generate your personalized study plan.'}</p>
        <button className="button button-lime" onClick={onGeneratePlan}><RefreshCw size={13} /> Recalculate schedule <ArrowRight size={14} /></button>
      </div>
    </section>

    <section className="stat-grid" aria-label="Study progress">
      <StatCard label="SUBJECTS" value={String(data.subjects.length).padStart(2, '0')} detail="in your workspace" icon={<BookOpen size={17} />} />
      <StatCard label="TOPICS MASTERED" value={String(completedTopics).padStart(2, '0')} detail={`${completion}% of all topics`} icon={<CheckCircle2 size={17} />} />
      <StatCard label="STUDY TIME" value={`${Math.floor(completedMinutes / 60)}h ${completedMinutes % 60}m`} detail="completed sessions" icon={<Clock3 size={17} />} />
      <StatCard label="NEXT EXAM" value={upcomingExams[0] ? `${daysUntil(upcomingExams[0].examDate)}d` : '—'} detail={upcomingExams[0]?.name ?? 'Add a subject to begin'} icon={<Target size={17} />} />
    </section>

    {/* High Priority Attention Alert Banner */}
    {highPriorityTopics.length > 0 && (
      <div style={{ background: '#fff', border: '1px solid #ebd9cf', borderRadius: '7px', padding: '14px 18px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ display: 'grid', width: '28px', height: '28px', placeItems: 'center', borderRadius: '6px', background: '#fcebe6', color: '#b84126' }}><Zap size={16} /></span>
          <div>
            <strong style={{ fontSize: '12px', color: '#363b34' }}>Top Priority Topics</strong>
            <span style={{ display: 'block', fontSize: '11px', color: '#888f82' }}>Calculated by exam proximity & diagnostic scores: {highPriorityTopics.map(t => `${t.name} (${t.priorityScore ?? 50}%)`).join(', ')}</span>
          </div>
        </div>
        <button className="button button-outline button-small" onClick={() => onView('schedule')}>View in schedule <ArrowRight size={13} /></button>
      </div>
    )}

    <section className="dashboard-columns">
      <div className="section-panel today-panel">
        <div className="panel-heading">
          <div><div className="section-kicker">YOUR DAY, AT A GLANCE</div><h2>Today’s plan</h2></div>
          <button className="text-button" onClick={() => onView('schedule')}>Full schedule <ArrowRight size={14} /></button>
        </div>
        {sessions.length ? (
          <div className="today-list">{sessions.map((session) => <SessionRow key={session.id} session={session} onToggle={() => onToggleSession(session.id)} />)}</div>
        ) : (
          <div className="today-empty"><div className="empty-icon small"><CalendarDays size={19} /></div><div><strong>No sessions planned for today</strong><span>Build or adapt your study plan from your active topics.</span></div><button className="button button-lime button-compact" onClick={() => onView('schedule')}>Plan sessions <ArrowRight size={14} /></button></div>
        )}
      </div>

      <div className="section-panel progress-panel">
        <div className="panel-heading"><div><div className="section-kicker">KEEP THE MOMENTUM</div><h2>Topic progress</h2></div><button className="text-button" onClick={() => onView('subjects')}>All subjects <ArrowRight size={14} /></button></div>
        <div className="progress-summary">
          <div className="progress-ring" style={{ '--progress': `${completion}%` } as React.CSSProperties}><span>{completion}<small>%</small></span></div>
          <div><strong>{completedTopics} of {completedTopics + remainingTopics.length} topics</strong><span>marked complete</span></div>
        </div>
        <div className="progress-subjects">
          {data.subjects.slice(0, 3).map((subject) => {
            const done = subject.topics.filter((topic) => topic.completed).length;
            const percent = subject.topics.length ? done / subject.topics.length * 100 : 0;
            return <button className="progress-subject" key={subject.id} onClick={() => onSelectSubject(subject.id)}><span><i style={{ background: subject.color }} />{subject.name}</span><strong>{done}/{subject.topics.length}</strong><span className="mini-progress"><i style={{ width: `${percent}%`, background: subject.color }} /></span></button>
          })}
          {data.subjects.length === 0 && <p className="quiet-empty">Add subjects to see your progress here.</p>}
        </div>
      </div>

      <div className="section-panel exams-panel">
        <div className="panel-heading"><div><div className="section-kicker">ON THE HORIZON</div><h2>Upcoming exams</h2></div><button className="text-button" onClick={() => onView('subjects')}>All subjects <ArrowRight size={14} /></button></div>
        <div className="exam-list">
          {upcomingExams.slice(0, 3).map((subject) => (
            <button className="exam-item" key={subject.id} onClick={() => onSelectSubject(subject.id)}>
              <span className="exam-date"><strong>{new Date(`${subject.examDate}T12:00:00`).getDate()}</strong><small>{formatDate(subject.examDate, { month: 'short' }).toUpperCase()}</small></span>
              <span className="exam-info"><strong>{subject.name}</strong><span>{subject.topics.length} topics to review</span></span>
              <span className="exam-countdown">{daysUntil(subject.examDate)} days</span>
            </button>
          ))}
          {upcomingExams.length === 0 && <div className="inline-empty"><span>No exams on the calendar yet.</span><button className="text-button" onClick={onAddSubject}>Add subject <Plus size={14} /></button></div>}
        </div>
      </div>
    </section>
  </>
}

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></article>
}

function SessionRow({ session, onToggle }: { session: StudySession; onToggle: () => void }) {
  const sessionType = session.sessionType ?? 'STUDY'
  return (
    <article className={`session-row ${session.completed ? 'session-done' : ''}`}>
      <span className="session-time">{session.startTime}</span>
      <span className="session-color" />
      <div className="session-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <strong>{session.topicName}</strong>
          {sessionType === 'REVISION' && <span className="session-type-pill session-type-revision">Revision</span>}
          {sessionType === 'QUIZ' && <span className="session-type-pill session-type-quiz">Quiz</span>}
        </div>
        <span>{session.subjectName} <i /> {session.durationMinutes >= 60 ? `${session.durationMinutes / 60} hr` : `${session.durationMinutes} min`}</span>
      </div>
      <button className={`session-check ${session.completed ? 'checked' : ''}`} onClick={onToggle} aria-label={session.completed ? 'Mark session incomplete' : 'Mark session complete'}>
        {session.completed && <Check size={14} />}
      </button>
    </article>
  )
}

function SubjectDetail({ subject, onAddTopic, onToggleTopic, onRemove, onGenerateAiQuiz }: {
  subject: Subject
  onAddTopic: () => void
  onToggleTopic: (subjectId: string, topicId: string) => void
  onRemove: () => void
  onGenerateAiQuiz: (topicId: string, options?: { difficulty?: Difficulty; customPrompt?: string }) => void
}) {
  const done = subject.topics.filter((topic) => topic.completed).length
  return (
    <>
      <div className="detail-top">
        <div className="detail-title-row">
          <span className="subject-swatch large" style={{ background: subject.color }} />
          <div><span className="section-kicker">SUBJECT OVERVIEW</span><h2>{subject.name}</h2></div>
          <button className="icon-button danger-icon" title="Remove subject" aria-label="Remove subject" onClick={() => { if (window.confirm(`Remove ${subject.name} from your planner?`)) onRemove() }}><Trash2 size={17} /></button>
        </div>
        <div className="detail-meta">
          <span><CalendarDays size={15} /> Exam date <strong>{formatDate(subject.examDate, { month: 'long', day: 'numeric', year: 'numeric' })}</strong></span>
          <span><ListChecks size={15} /> Progress <strong>{done} / {subject.topics.length} topics</strong></span>
        </div>
        <div className="detail-progress"><i style={{ width: `${subject.topics.length ? done / subject.topics.length * 100 : 0}%`, background: subject.color }} /></div>
      </div>
      <div className="topic-section">
        <div className="topic-heading">
          <div><span className="section-kicker">YOUR SYLLABUS</span><h3>Topics <span className="subtle-count">{subject.topics.length}</span></h3></div>
          <button className="button button-dark button-small" onClick={onAddTopic}><Plus size={15} /> Add topic</button>
        </div>
        {subject.topics.length ? (
          <div className="topic-list">
            {subject.topics.map((topic) => (
              <article className={`topic-row ${topic.completed ? 'topic-completed' : ''}`} key={topic.id}>
                <button className={`topic-toggle ${topic.completed ? 'checked' : ''}`} onClick={() => onToggleTopic(subject.id, topic.id)} aria-label={topic.completed ? `Mark ${topic.name} incomplete` : `Mark ${topic.name} complete`}>
                  {topic.completed && <Check size={13} />}
                </button>
                <div className="topic-copy">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong>{topic.name}</strong>
                    {topic.priorityScore !== undefined && (
                      <span className={`topic-ai-badge ${topic.priorityScore >= 70 ? 'topic-priority-high' : topic.priorityScore >= 45 ? 'topic-priority-medium' : ''}`}>
                        Priority {topic.priorityScore}%
                      </span>
                    )}
                  </div>
                  <span>{topic.hours} estimated hours {topic.quizAttemptsCount ? `· ${topic.quizAttemptsCount} quizzes taken` : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button className="button-ai-quiz" onClick={() => onGenerateAiQuiz(topic.id, { difficulty: topic.difficulty })} title="Practice diagnostic questions"><BookOpen size={12} /> Practice Quiz</button>
                  <span className={`difficulty difficulty-${topic.difficulty.toLowerCase()}`}>{topic.difficulty}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="topic-empty"><div className="empty-icon small"><BookOpen size={18} /></div><div><strong>Start with one topic</strong><span>Break this subject into manageable pieces.</span></div><button className="text-button" onClick={onAddTopic}>Add a topic <Plus size={14} /></button></div>
        )}
      </div>
    </>
  )
}

function Schedule({ data, onGenerate, onToggleSession }: {
  data: PlannerData
  onGenerate: (prompt?: string) => void
  onToggleSession: (id: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const sessions = [...data.sessions].sort((first, second) => first.date.localeCompare(second.date) || first.startTime.localeCompare(second.startTime))
  const weekDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return date })
  const visibleDates = [...new Set([...weekDays.map(dateKey), ...sessions.map((session) => session.date)])].sort()
  const scheduleDays = visibleDates.map((date) => new Date(`${date}T12:00:00`))
  const weekMinutes = sessions.reduce((total, session) => total + session.durationMinutes, 0)

  const quickPrompts = [
    'Focus on nearest upcoming exams',
    'Prioritize difficult topics first',
    'More revision sessions',
    'Equal distribution across subjects',
  ]

  return (
    <section className="schedule-page">
      {/* Scheduling Preferences Header */}
      <div className="ai-planner-bar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div>
            <span className="section-kicker"><SlidersHorizontal size={13} /> SCHEDULE PREFERENCES & FOCUS</span>
            <strong style={{ fontSize: '13px', color: '#2b3127' }}>Set subject focus and timetable priorities</strong>
          </div>
          <span style={{ fontSize: '11px', color: '#747c6e' }}>Daily capacity: <strong>{data.dailyStudyHours} hrs/day</strong></span>
        </div>
        <div className="ai-prompt-input-row">
          <input
            className="ai-prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onGenerate(prompt) }}
            placeholder="e.g. Focus on Linked Lists more, prioritize Network Security, balance all subjects..."
          />
          <button className="button button-lime" onClick={() => onGenerate(prompt)}>
            <CalendarDays size={15} /> Update timetable
          </button>
        </div>
        <div className="ai-prompt-chips">
          <span className="prompt-chip-label">Quick suggestions:</span>
          {quickPrompts.map((qp) => (
            <button key={qp} type="button" className="prompt-chip" onClick={() => { setPrompt(qp); onGenerate(qp) }}>
              {qp}
            </button>
          ))}
          {prompt && (
            <button type="button" className="prompt-chip" style={{ color: '#b84126' }} onClick={() => { setPrompt(''); onGenerate('') }}>
              Clear filter
            </button>
          )}
        </div>
      </div>

      <div className="schedule-summary">
        <div>
          <span className="section-kicker">ADAPTIVE TIMETABLE</span>
          <h2>A steady rhythm beats a last-minute sprint.</h2>
          <p>{sessions.length ? `${sessions.length} sessions · ${Math.round(weekMinutes / 60 * 10) / 10} planned hours with cognitive interleaving` : 'Your calendar is clear. Generate a plan from your active topics.'}</p>
        </div>
      </div>

      <div className="week-strip">
        {weekDays.map((date) => {
          const key = dateKey(date)
          const daySessions = sessions.filter((session) => session.date === key)
          return (
            <div className={`week-day ${key === dateKey(new Date()) ? 'is-today' : ''}`} key={key}>
              <span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date).toUpperCase()}</span>
              <strong>{date.getDate()}</strong>
              <i className={daySessions.length ? 'has-events' : ''} />
            </div>
          )
        })}
      </div>

      <div className="schedule-list">
        {scheduleDays.map((date) => {
          const key = dateKey(date)
          const daySessions = sessions.filter((session) => session.date === key)
          return (
            <section className="schedule-day" key={key}>
              <div className="schedule-day-label">
                <span>{new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date)}</span>
                <small>{formatDate(key, { month: 'short', day: 'numeric' })}{key === dateKey(new Date()) ? ' · TODAY' : ''}</small>
              </div>
              <div className="schedule-day-events">
                {daySessions.length ? daySessions.map((session) => (
                  <SessionRow key={session.id} session={session} onToggle={() => onToggleSession(session.id)} />
                )) : <div className="free-day">Open day <span>Take a break or review flashcards</span></div>}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function Quizzes({ data, onAddQuestion, onRemoveQuestion, onAnswerQuestion, onGenerateAiQuiz }: {
  data: PlannerData
  onAddQuestion: (topicId: string, prompt: string, options: string[], answer: string, explanation?: string) => Promise<unknown>
  onRemoveQuestion: (id: string) => Promise<unknown>
  onAnswerQuestion: (questionId: string, selected: string) => Promise<{ correct: boolean; correctAnswer: string; explanation?: string }>
  onGenerateAiQuiz: (topicId: string, options?: { difficulty?: Difficulty; customPrompt?: string }) => Promise<unknown>
}) {
  const [isCreating, setIsCreating] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; correctAnswer: string; explanation?: string } | null>(null)
  const [isAnswering, setIsAnswering] = useState(false)
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)
  const [quizError, setQuizError] = useState('')
  const [topicId, setTopicId] = useState(data.subjects.flatMap((subject) => subject.topics)[0]?.id ?? '')
  const [quizTopicId, setQuizTopicId] = useState(data.subjects.flatMap((subject) => subject.topics)[0]?.id ?? '')
  const [quizDifficulty, setQuizDifficulty] = useState<Difficulty>('Medium')
  const [quizPrompt, setQuizPrompt] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL')
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({})

  const topics = data.subjects.flatMap((subject) => subject.topics.map((topic) => ({ ...topic, subjectName: subject.name, subjectId: subject.id })))
  const question = data.questions.find((item) => item.id === activeQuestion)

  const quizQuickPrompts = [
    'Time & Space Complexity',
    'Scenario-based Architecture',
    'Security Exploits & Mitigations',
    'Bottlenecks & Trade-offs',
    'Edge Cases & Fault Recovery',
  ]

  const filteredQuestions = useMemo(() => {
    let result = data.questions
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((item) => {
        const topic = topics.find((entry) => entry.id === item.topicId)
        return (
          item.prompt.toLowerCase().includes(q) ||
          item.topicName.toLowerCase().includes(q) ||
          (topic?.subjectName.toLowerCase().includes(q) ?? false)
        )
      })
    }
    return result
  }, [data.questions, searchQuery, topics])

  const groupedQuestions = useMemo(() => {
    return data.subjects
      .map((s) => {
        const subjectQuestions = filteredQuestions.filter(
          (q) => q.subjectName.trim().toLowerCase() === s.name.trim().toLowerCase()
        )
        return {
          subjectId: s.id,
          subjectName: s.name,
          subjectColor: s.color,
          questions: subjectQuestions,
        }
      })
      .filter((g) => selectedSubjectFilter === 'ALL' || g.subjectId === selectedSubjectFilter)
      .filter((g) => g.questions.length > 0)
  }, [data.subjects, filteredQuestions, selectedSubjectFilter])

  const isSubjectExpanded = (subId: string) => {
    if (selectedSubjectFilter !== 'ALL' && selectedSubjectFilter === subId) return true
    return expandedSubjects[subId] ?? true
  }

  const toggleSubjectExpand = (subId: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subId]: !(prev[subId] ?? true),
    }))
  }

  const expandAllSubjects = () => {
    const next: Record<string, boolean> = {}
    groupedQuestions.forEach((g) => { next[g.subjectId] = true })
    setExpandedSubjects(next)
  }

  const collapseAllSubjects = () => {
    const next: Record<string, boolean> = {}
    groupedQuestions.forEach((g) => { next[g.subjectId] = false })
    setExpandedSubjects(next)
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const options = [1, 2, 3, 4].map((index) => String(form.get(`option-${index}`) ?? '').trim()).filter(Boolean)
    const prompt = String(form.get('prompt') ?? '').trim()
    const answer = String(form.get('answer') ?? '')
    const explanation = String(form.get('explanation') ?? '').trim()
    if (!topicId || !prompt || options.length < 2 || !answer) return
    const saved = await onAddQuestion(topicId, prompt, options, answer, explanation)
    if (!saved) return
    formElement.reset()
    setIsCreating(false)
  }

  function chooseQuestion(id: string) {
    setActiveQuestion(id)
    setSelectedAnswer('')
    setRevealed(false)
    setAnswerResult(null)
    setQuizError('')
  }

  async function submitAnswer() {
    if (!question || !selectedAnswer) return
    setIsAnswering(true)
    setQuizError('')
    try {
      const result = await onAnswerQuestion(question.id, selectedAnswer)
      setAnswerResult(result)
      setRevealed(true)
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Could not submit your answer')
    } finally {
      setIsAnswering(false)
    }
  }

  async function handleAiGen() {
    const targetTopicId = quizTopicId || topicId
    if (!targetTopicId) return
    setIsGeneratingAi(true)
    try {
      const generated = await onGenerateAiQuiz(targetTopicId, {
        difficulty: quizDifficulty,
        customPrompt: quizPrompt,
      }) as { id: string }[] | undefined
      if (generated && generated.length > 0) {
        chooseQuestion(generated[0].id)
      }
    } finally {
      setIsGeneratingAi(false)
    }
  }

  async function deleteQuestion(questionId: string) {
    const deleted = await onRemoveQuestion(questionId)
    if (!deleted) return
    if (activeQuestion === questionId) chooseQuestion('')
  }

  return (
    <section className="quiz-page">
      <div className="quiz-intro">
        <div className="quiz-icon"><CircleHelp size={21} /></div>
        <div>
          <span className="section-kicker">ACTIVE RECALL & RETENTION PRACTICE</span>
          <h2>Diagnostic Practice Questions</h2>
          <p>Every response updates your topic mastery score in real-time, helping the scheduler allocate more practice where needed.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
          <button className="button button-dark button-small" onClick={() => setIsCreating((current) => !current)} disabled={!topics.length}>
            <Plus size={15} /> Write question
          </button>
        </div>
      </div>

      {/* Practice Quiz Generator Bar */}
      <div className="ai-planner-bar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span className="section-kicker"><SlidersHorizontal size={13} /> PRACTICE QUIZ GENERATOR</span>
            <strong style={{ fontSize: '13px', color: '#2b3127' }}>Generate targeted questions by topic, difficulty & learning objectives</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#747c6e', fontWeight: 600, marginRight: '4px' }}>Difficulty:</span>
            {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                className={`difficulty-pill ${quizDifficulty === d ? 'active' : ''}`}
                onClick={() => setQuizDifficulty(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(210px, 300px) 1fr auto', gap: '10px', alignItems: 'center' }}>
          <select
            className="ai-prompt-input"
            value={quizTopicId}
            onChange={(e) => setQuizTopicId(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            {data.subjects.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {s.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.difficulty})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            className="ai-prompt-input"
            value={quizPrompt}
            onChange={(e) => setQuizPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAiGen() }}
            placeholder="e.g. Focus on scenario questions, time complexity, or security vulnerabilities..."
          />
          <button
            className="button button-lime"
            onClick={handleAiGen}
            disabled={!quizTopicId || isGeneratingAi}
            style={{ whiteSpace: 'nowrap' }}
          >
            <Target size={15} /> {isGeneratingAi ? 'Generating…' : 'Generate Quiz'}
          </button>
        </div>

        <div className="ai-prompt-chips">
          <span className="prompt-chip-label">Quick suggestions:</span>
          {quizQuickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              className="prompt-chip"
              onClick={() => { setQuizPrompt(qp); }}
            >
              {qp}
            </button>
          ))}
          {quizPrompt && (
            <button
              type="button"
              className="prompt-chip"
              style={{ color: '#b84126' }}
              onClick={() => setQuizPrompt('')}
            >
              Clear prompt
            </button>
          )}
        </div>
      </div>

      <div className="quiz-workspace">
        <div className="question-bank">
          <div className="panel-toolbar" style={{ marginBottom: '8px' }}>
            <div>
              <h2>Question bank <span className="subtle-count">{filteredQuestions.length}</span></h2>
              <p>Grouped by subject</p>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                type="button"
                className="qb-toggle-all-btn"
                onClick={expandAllSubjects}
                title="Expand all subjects"
              >
                Expand all
              </button>
              <button
                type="button"
                className="qb-toggle-all-btn"
                onClick={collapseAllSubjects}
                title="Collapse all subjects"
              >
                Collapse all
              </button>
            </div>
          </div>

          {/* Horizontal Subject Pill Tabs */}
          <div className="qb-tabs-bar" role="tablist" aria-label="Subject filter tabs">
            <button
              type="button"
              className={`qb-tab-pill ${selectedSubjectFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedSubjectFilter('ALL')}
            >
              All ({data.questions.length})
            </button>
            {data.subjects.map((s) => {
              const count = data.questions.filter(
                (q) => q.subjectName.trim().toLowerCase() === s.name.trim().toLowerCase()
              ).length
              if (count === 0) return null
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`qb-tab-pill ${selectedSubjectFilter === s.id ? 'active' : ''}`}
                  onClick={() => setSelectedSubjectFilter(s.id)}
                >
                  <span className="qb-subject-dot" style={{ background: s.color }} />
                  {s.name} ({count})
                </button>
              )
            })}
          </div>

          <label className="search-field" style={{ marginBottom: '10px' }}>
            <Search size={15} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by keyword, topic or prompt..."
            />
            {searchQuery && (
              <button
                type="button"
                className="icon-button small-icon"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                style={{ marginLeft: 'auto' }}
              >
                <X size={13} />
              </button>
            )}
          </label>

          {groupedQuestions.length ? (
            <div className="qb-accordion">
              {groupedQuestions.map((group) => {
                const isOpen = isSubjectExpanded(group.subjectId)
                return (
                  <div key={group.subjectId} className={`qb-group ${isOpen ? 'is-open' : ''}`}>
                    <button
                      type="button"
                      className="qb-group-header"
                      onClick={() => toggleSubjectExpand(group.subjectId)}
                      aria-expanded={isOpen}
                    >
                      <ChevronRight size={14} className={`qb-chevron ${isOpen ? 'rotated' : ''}`} />
                      <span className="qb-subject-dot" style={{ background: group.subjectColor }} />
                      <span className="qb-group-title">{group.subjectName}</span>
                      <span className="qb-group-count">{group.questions.length}</span>
                    </button>

                    {isOpen && (
                      <div className="qb-group-items">
                        {group.questions.map((item) => (
                          <div
                            className={`question-bank-item ${activeQuestion === item.id ? 'selected' : ''}`}
                            key={item.id}
                          >
                            <button onClick={() => chooseQuestion(item.id)}>
                              <span className="question-topic">{item.topicName}</span>
                              <strong>{item.prompt}</strong>
                              <span>{item.options.length} choices</span>
                            </button>
                            <button
                              className="icon-button small-icon danger-icon"
                              aria-label="Delete question"
                              onClick={() => void deleteQuestion(item.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="question-empty">
              <div className="empty-icon"><CircleHelp size={22} /></div>
              <strong>No questions found</strong>
              <span>Try adjusting your subject filter or search keyword.</span>
              {(selectedSubjectFilter !== 'ALL' || searchQuery) && (
                <button
                  className="button button-outline button-small"
                  onClick={() => { setSelectedSubjectFilter('ALL'); setSearchQuery(''); }}
                  style={{ marginTop: '8px' }}
                >
                  Reset filters
                </button>
              )}
            </div>
          )}
        </div>

        <div className="quiz-card">
          {isCreating ? (
            <form className="question-form" onSubmit={handleCreate}>
              <div className="panel-toolbar">
                <div><span className="section-kicker">NEW QUESTION</span><h2>Write a prompt</h2></div>
                <button type="button" className="icon-button" aria-label="Close form" onClick={() => setIsCreating(false)}><X size={17} /></button>
              </div>
              <label className="form-label">Topic
                <select value={topicId} onChange={(event) => setTopicId(event.target.value)} required>
                  {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subjectName} / {topic.name}</option>)}
                </select>
              </label>
              <label className="form-label">Question
                <textarea name="prompt" placeholder="What core concept do you want to test?" rows={3} required />
              </label>
              <div className="options-label">ANSWER CHOICES</div>
              <div className="option-inputs">
                {[1, 2, 3, 4].map((index) => (
                  <label className="option-input" key={index}>
                    <span>{String.fromCharCode(64 + index)}</span>
                    <input name={`option-${index}`} placeholder={`Choice ${index}`} required={index < 3} />
                  </label>
                ))}
              </div>
              <label className="form-label">Correct answer
                <select name="answer" required defaultValue="">
                  <option value="" disabled>Select a choice</option>
                  {[1, 2, 3, 4].map((index) => <option key={index} value={String.fromCharCode(64 + index)}>Choice {String.fromCharCode(64 + index)}</option>)}
                </select>
              </label>
              <label className="form-label">Explanation (optional)
                <input name="explanation" placeholder="Why is this answer correct?" />
              </label>
              <div className="form-actions">
                <button type="button" className="button button-outline" onClick={() => setIsCreating(false)}>Cancel</button>
                <button className="button button-lime" type="submit"><Check size={15} /> Save question</button>
              </div>
            </form>
          ) : question ? (
            <div className="quiz-play">
              <div className="quiz-play-meta"><span className="section-kicker">ACTIVE PRACTICE</span><span>{question.topicName}</span></div>
              <h2>{question.prompt}</h2>
              <div className="quiz-options">
                {question.options.map((option, index) => {
                  const key = String.fromCharCode(65 + index)
                  const isCorrect = revealed && key === answerResult?.correctAnswer
                  const isWrong = revealed && key === selectedAnswer && key !== answerResult?.correctAnswer
                  return (
                    <button key={key} className={`quiz-option ${selectedAnswer === key ? 'chosen' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`} onClick={() => !revealed && setSelectedAnswer(key)}>
                      <span>{key}</span>{option}
                      {isCorrect && <CheckCircle2 size={17} />}
                      {isWrong && <X size={17} />}
                    </button>
                  )
                })}
              </div>

              {quizError && <div className="answer-feedback feedback-wrong" role="alert">{quizError}</div>}

              {revealed && answerResult ? (
                <div>
                  <div className={`answer-feedback ${answerResult.correct ? 'feedback-correct' : 'feedback-wrong'}`}>
                    {answerResult.correct ? '✓ Correct! Great recall.' : `✕ Not quite. The correct answer is Choice ${answerResult.correctAnswer}.`}
                  </div>
                  {(answerResult.explanation || question.explanation) && (
                    <div className="explanation-card">
                      <strong>Concept Explanation:</strong>
                      {answerResult.explanation || question.explanation}
                    </div>
                  )}
                  <div style={{ marginTop: '12px', fontSize: '11px', color: '#68705f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={13} />
                    <span>Topic mastery recorded. Upcoming sessions have been adapted automatically.</span>
                  </div>
                </div>
              ) : (
                <button className="button button-dark check-answer" disabled={!selectedAnswer || isAnswering} onClick={() => void submitAnswer()}>
                  {isAnswering ? 'Grading answer…' : 'Check answer'} <ArrowRight size={15} />
                </button>
              )}
            </div>
          ) : (
            <div className="quiz-placeholder">
              <div className="quiz-deco"><div className="deco-note"><span /><span /><span /></div><div className="deco-star"><Target size={18} /></div></div>
              <span className="section-kicker">RETRIEVAL PRACTICE</span>
              <h2>Active recall drives<br />real retention.</h2>
              <p>Select a question from the question bank or generate practice questions for any topic.</p>
              <div className="quiz-tip"><Target size={17} /><span>Answering questions activates retrieval pathways, strengthening memory before exams.</span></div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SubjectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (name: string, examDate: string) => void }) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const examDate = String(form.get('examDate') ?? '')
    if (name && examDate) onSubmit(name, examDate)
  }
  return (
    <Modal title="Add a subject" subtitle="Start with the course and its next exam date." onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <label className="form-label">Subject name<input name="name" placeholder="e.g. Computer Networks" autoFocus required /></label>
        <label className="form-label">Exam date<input name="examDate" type="date" min={dateKey(new Date())} required /></label>
        <div className="form-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-lime" type="submit"><Plus size={15} /> Add subject</button></div>
      </form>
    </Modal>
  )
}

function TopicModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (name: string, difficulty: Difficulty, hours: number) => void }) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const difficulty = String(form.get('difficulty') ?? 'Medium') as Difficulty
    const hours = Number(form.get('hours'))
    if (name && hours > 0) onSubmit(name, difficulty, hours)
  }
  return (
    <Modal title="Add a topic" subtitle="Break your subject into manageable study units." onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <label className="form-label">Topic name<input name="name" placeholder="e.g. Dynamic Programming" autoFocus required /></label>
        <div className="form-row">
          <label className="form-label">Difficulty
            <select name="difficulty" defaultValue="Medium">
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </label>
          <label className="form-label">Est. hours<input name="hours" type="number" min="0.5" step="0.5" defaultValue="2" required /></label>
        </div>
        <div className="form-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-lime" type="submit"><Plus size={15} /> Add topic</button></div>
      </form>
    </Modal>
  )
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return (
    <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

export default App
