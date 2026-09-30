import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
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
    const timeout = window.setTimeout(() => setNotice(''), 2600)
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

  async function generatePlan() {
    const sessions = await persist(() => plannerApi.generateSchedule(), 'Study plan saved')
    if (!sessions) return
    setView('schedule')
    setNotice(`${sessions.length} sessions planned`)
  }

  async function toggleSession(sessionId: string) {
    const session = data.sessions.find((item) => item.id === sessionId)
    if (session) await persist(() => plannerApi.setSessionCompleted(sessionId, !session.completed), 'Session progress saved')
  }

  async function addQuestion(topicId: string, prompt: string, options: string[], answer: string) {
    return persist(() => plannerApi.addQuestion(topicId, prompt, options, answer), 'Question saved')
  }

  async function removeQuestion(questionId: string) {
    return persist(() => plannerApi.removeQuestion(questionId).then(() => true), 'Question removed')
  }

  async function answerQuestion(questionId: string, selected: string) {
    return plannerApi.answerQuestion(questionId, selected)
  }

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
          <div className="topbar-actions"><span className="today-label"><CalendarDays size={15} />{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span><button className="button button-dark button-small" disabled={!hasLoaded || isSaving} onClick={() => setShowSubjectForm(true)}><Plus size={16} /> Add subject</button></div>
        </header>

        <div className="page-content">
          {isLoading && !hasLoaded ? <div className="connection-state">Loading your planner…</div> : !hasLoaded ? <div className="connection-state connection-error"><h2>Could not load your planner</h2><p>{loadError}</p><button className="button button-dark" onClick={() => void reloadPlanner()}>Retry connection</button></div> : <>
          {loadError && <div className="connection-banner" role="alert"><span>{loadError}</span><button className="text-button" onClick={() => void reloadPlanner()}>Retry</button></div>}
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR STUDY SPACE</div><h1>{pageTitle}</h1><p>{view === 'overview' ? 'A clear plan makes the next step easier.' : view === 'subjects' ? 'Keep your courses, topics, and exam dates together.' : view === 'schedule' ? 'A steady rhythm beats a last-minute sprint.' : 'Write your own questions and use them for active recall.'}</p></div>
            {view === 'overview' && <button className="button button-lime" onClick={generatePlan}><Sparkles size={16} /> Build my study plan <ArrowRight size={15} /></button>}
          </section>

          {view === 'overview' && <Overview
            data={data}
            upcomingExams={upcomingExams}
            todaysSessions={todaysSessions}
            remainingTopics={remainingTopics}
            completedTopics={completedTopics}
            completion={completion}
            completedMinutes={completedMinutes}
            onView={setView}
            onToggleSession={toggleSession}
            onSelectSubject={(id) => { setSelectedSubjectId(id); setView('subjects') }}
            onAddSubject={() => setShowSubjectForm(true)}
          />}

          {view === 'subjects' && <section className="subjects-layout">
            <div className="subject-list-panel">
              <div className="panel-toolbar"><div><h2>Subjects <span className="subtle-count">{data.subjects.length}</span></h2><p>Exam dates and topic progress</p></div><button className="icon-button" aria-label="Add subject" title="Add subject" onClick={() => setShowSubjectForm(true)}><Plus size={18} /></button></div>
              <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a subject" /></label>
              <div className="subject-list">{filteredSubjects.map((subject) => {
                const done = subject.topics.filter((topic) => topic.completed).length
                const percent = subject.topics.length ? Math.round((done / subject.topics.length) * 100) : 0
                return <button key={subject.id} className={`subject-list-item ${selectedSubjectId === subject.id ? 'selected' : ''}`} onClick={() => setSelectedSubjectId(subject.id)}><span className="subject-swatch" style={{ background: subject.color }} /><span className="subject-list-main"><strong>{subject.name}</strong><span>{subject.topics.length} topics · exam {formatDate(subject.examDate)}</span><span className="mini-progress"><i style={{ width: `${percent}%`, background: subject.color }} /></span></span><span className="item-percent">{percent}%</span></button>
              })}{filteredSubjects.length === 0 && <div className="empty-search">No subjects match that search.</div>}</div>
              <button className="add-subject-row" onClick={() => setShowSubjectForm(true)}><Plus size={16} /> Add a subject</button>
            </div>
            <div className="subject-detail-panel">{selectedSubject ? <SubjectDetail subject={selectedSubject} onAddTopic={() => setShowTopicForm(true)} onToggleTopic={toggleTopic} onRemove={() => removeSubject(selectedSubject.id)} /> : <div className="detail-empty"><div className="empty-icon"><BookOpen size={22} /></div><h2>Choose a subject</h2><p>Select one from the list to see its topics and progress.</p><button className="button button-outline" onClick={() => setShowSubjectForm(true)}><Plus size={16} /> Add your first subject</button></div>}</div>
          </section>}

          {view === 'schedule' && <Schedule data={data} onGenerate={generatePlan} onToggleSession={toggleSession} />}
          {view === 'quizzes' && <Quizzes data={data} onAddQuestion={addQuestion} onRemoveQuestion={removeQuestion} onAnswerQuestion={answerQuestion} />}
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

function Overview({ data, upcomingExams, todaysSessions, remainingTopics, completedTopics, completion, completedMinutes, onView, onToggleSession, onSelectSubject, onAddSubject }: {
  data: PlannerData
  upcomingExams: Subject[]
  todaysSessions: StudySession[]
  remainingTopics: (Topic & { subjectName: string; subjectId: string })[]
  completedTopics: number
  completion: number
  completedMinutes: number
  onView: (view: View) => void
  onToggleSession: (id: string) => void
  onSelectSubject: (id: string) => void
  onAddSubject: () => void
}) {
  const sessions = [...todaysSessions].sort((first, second) => first.startTime.localeCompare(second.startTime))
  return <>
    <section className="welcome-band"><div className="welcome-copy"><div className="welcome-kicker">STUDY OVERVIEW</div><h2>Your next step, clearly planned.</h2><p>{remainingTopics.length ? `${remainingTopics.length} active topics across ${data.subjects.length} subjects.` : 'Add a subject and its topics to build your study plan.'}</p><button className="button button-outline" onClick={() => onView('subjects')}>Browse subjects <ArrowRight size={15} /></button></div></section>

    <section className="stat-grid" aria-label="Study progress"><StatCard label="SUBJECTS" value={String(data.subjects.length).padStart(2, '0')} detail="in your workspace" icon={<BookOpen size={17} />} /><StatCard label="TOPICS MASTERED" value={String(completedTopics).padStart(2, '0')} detail={`${completion}% of all topics`} icon={<CheckCircle2 size={17} />} /><StatCard label="STUDY TIME" value={`${Math.floor(completedMinutes / 60)}h ${completedMinutes % 60}m`} detail="completed sessions" icon={<Clock3 size={17} />} /><StatCard label="NEXT EXAM" value={upcomingExams[0] ? `${daysUntil(upcomingExams[0].examDate)}d` : '—'} detail={upcomingExams[0]?.name ?? 'Add a subject to begin'} icon={<Target size={17} />} /></section>

    <section className="dashboard-columns"><div className="section-panel today-panel"><div className="panel-heading"><div><div className="section-kicker">YOUR DAY, AT A GLANCE</div><h2>Today’s plan</h2></div><button className="text-button" onClick={() => onView('schedule')}>Full schedule <ArrowRight size={14} /></button></div>{sessions.length ? <div className="today-list">{sessions.map((session) => <SessionRow key={session.id} session={session} onToggle={() => onToggleSession(session.id)} />)}</div> : <div className="today-empty"><div className="empty-icon small"><CalendarDays size={19} /></div><div><strong>No sessions planned for today</strong><span>Build a study plan from your active topics.</span></div><button className="button button-lime button-compact" onClick={() => onView('schedule')}>Plan sessions <ArrowRight size={14} /></button></div>}</div>

      <div className="section-panel progress-panel"><div className="panel-heading"><div><div className="section-kicker">KEEP THE MOMENTUM</div><h2>Topic progress</h2></div><button className="text-button" onClick={() => onView('subjects')}>All subjects <ArrowRight size={14} /></button></div><div className="progress-summary"><div className="progress-ring" style={{ '--progress': `${completion}%` } as React.CSSProperties}><span>{completion}<small>%</small></span></div><div><strong>{completedTopics} of {completedTopics + remainingTopics.length} topics</strong><span>marked complete</span></div></div><div className="progress-subjects">{data.subjects.slice(0, 3).map((subject) => { const done = subject.topics.filter((topic) => topic.completed).length; const percent = subject.topics.length ? done / subject.topics.length * 100 : 0; return <button className="progress-subject" key={subject.id} onClick={() => onSelectSubject(subject.id)}><span><i style={{ background: subject.color }} />{subject.name}</span><strong>{done}/{subject.topics.length}</strong><span className="mini-progress"><i style={{ width: `${percent}%`, background: subject.color }} /></span></button> })}{data.subjects.length === 0 && <p className="quiet-empty">Add subjects to see your progress here.</p>}</div></div>

      <div className="section-panel exams-panel"><div className="panel-heading"><div><div className="section-kicker">ON THE HORIZON</div><h2>Upcoming exams</h2></div><button className="text-button" onClick={() => onView('subjects')}>All subjects <ArrowRight size={14} /></button></div><div className="exam-list">{upcomingExams.slice(0, 3).map((subject) => <button className="exam-item" key={subject.id} onClick={() => onSelectSubject(subject.id)}><span className="exam-date"><strong>{new Date(`${subject.examDate}T12:00:00`).getDate()}</strong><small>{formatDate(subject.examDate, { month: 'short' }).toUpperCase()}</small></span><span className="exam-info"><strong>{subject.name}</strong><span>{subject.topics.length} topics to review</span></span><span className="exam-countdown">{daysUntil(subject.examDate)} days</span></button>)}{upcomingExams.length === 0 && <div className="inline-empty"><span>No exams on the calendar yet.</span><button className="text-button" onClick={onAddSubject}>Add subject <Plus size={14} /></button></div>}</div></div>

    </section>
  </>
}

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></article>
}

function SessionRow({ session, onToggle }: { session: StudySession; onToggle: () => void }) {
  return <article className={`session-row ${session.completed ? 'session-done' : ''}`}><span className="session-time">{session.startTime}</span><span className="session-color" /><div className="session-info"><strong>{session.topicName}</strong><span>{session.subjectName} <i /> {session.durationMinutes >= 60 ? `${session.durationMinutes / 60} hr` : `${session.durationMinutes} min`}</span></div><button className={`session-check ${session.completed ? 'checked' : ''}`} onClick={onToggle} aria-label={session.completed ? 'Mark session incomplete' : 'Mark session complete'}>{session.completed && <Check size={14} />}</button></article>
}

function SubjectDetail({ subject, onAddTopic, onToggleTopic, onRemove }: { subject: Subject; onAddTopic: () => void; onToggleTopic: (subjectId: string, topicId: string) => void; onRemove: () => void }) {
  const done = subject.topics.filter((topic) => topic.completed).length
  return <><div className="detail-top"><div className="detail-title-row"><span className="subject-swatch large" style={{ background: subject.color }} /><div><span className="section-kicker">SUBJECT OVERVIEW</span><h2>{subject.name}</h2></div><button className="icon-button danger-icon" title="Remove subject" aria-label="Remove subject" onClick={() => { if (window.confirm(`Remove ${subject.name} from your planner?`)) onRemove() }}><Trash2 size={17} /></button></div><div className="detail-meta"><span><CalendarDays size={15} /> Exam date <strong>{formatDate(subject.examDate, { month: 'long', day: 'numeric', year: 'numeric' })}</strong></span><span><ListChecks size={15} /> Progress <strong>{done} / {subject.topics.length} topics</strong></span></div><div className="detail-progress"><i style={{ width: `${subject.topics.length ? done / subject.topics.length * 100 : 0}%`, background: subject.color }} /></div></div><div className="topic-section"><div className="topic-heading"><div><span className="section-kicker">YOUR SYLLABUS</span><h3>Topics <span className="subtle-count">{subject.topics.length}</span></h3></div><button className="button button-dark button-small" onClick={onAddTopic}><Plus size={15} /> Add topic</button></div>{subject.topics.length ? <div className="topic-list">{subject.topics.map((topic) => <article className={`topic-row ${topic.completed ? 'topic-completed' : ''}`} key={topic.id}><button className={`topic-toggle ${topic.completed ? 'checked' : ''}`} onClick={() => onToggleTopic(subject.id, topic.id)} aria-label={topic.completed ? `Mark ${topic.name} incomplete` : `Mark ${topic.name} complete`}>{topic.completed && <Check size={13} />}</button><div className="topic-copy"><strong>{topic.name}</strong><span>{topic.hours} estimated hours</span></div><span className={`difficulty difficulty-${topic.difficulty.toLowerCase()}`}>{topic.difficulty}</span></article>)}</div> : <div className="topic-empty"><div className="empty-icon small"><BookOpen size={18} /></div><div><strong>Start with one topic</strong><span>Break this subject into manageable pieces.</span></div><button className="text-button" onClick={onAddTopic}>Add a topic <Plus size={14} /></button></div>}</div></>
}

function Schedule({ data, onGenerate, onToggleSession }: { data: PlannerData; onGenerate: () => void; onToggleSession: (id: string) => void }) {
  const sessions = [...data.sessions].sort((first, second) => first.date.localeCompare(second.date) || first.startTime.localeCompare(second.startTime))
  const weekDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index); return date })
  const visibleDates = [...new Set([...weekDays.map(dateKey), ...sessions.map((session) => session.date)])].sort()
  const scheduleDays = visibleDates.map((date) => new Date(`${date}T12:00:00`))
  const weekMinutes = sessions.reduce((total, session) => total + session.durationMinutes, 0)
  return <section className="schedule-page"><div className="schedule-summary"><div><span className="section-kicker">STUDY PLAN · {data.dailyStudyHours} HRS / DAY</span><h2>A little progress, every day.</h2><p>{sessions.length ? `${sessions.length} sessions · ${Math.round(weekMinutes / 60 * 10) / 10} planned hours` : 'Your calendar is clear. Make a plan from your active topics.'}</p></div><button className="button button-outline" onClick={onGenerate}><Sparkles size={16} /> Generate study plan</button></div><div className="week-strip">{weekDays.map((date) => { const key = dateKey(date); const daySessions = sessions.filter((session) => session.date === key); return <div className={`week-day ${key === dateKey(new Date()) ? 'is-today' : ''}`} key={key}><span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date).toUpperCase()}</span><strong>{date.getDate()}</strong><i className={daySessions.length ? 'has-events' : ''} /></div> })}</div><div className="schedule-list">{scheduleDays.map((date) => { const key = dateKey(date); const daySessions = sessions.filter((session) => session.date === key); return <section className="schedule-day" key={key}><div className="schedule-day-label"><span>{new Intl.DateTimeFormat('en', { weekday: 'long' }).format(date)}</span><small>{formatDate(key, { month: 'short', day: 'numeric' })}{key === dateKey(new Date()) ? ' · TODAY' : ''}</small></div><div className="schedule-day-events">{daySessions.length ? daySessions.map((session) => <SessionRow key={session.id} session={session} onToggle={() => onToggleSession(session.id)} />) : <div className="free-day">Open day <span>Take a break or add a session</span></div>}</div></section> })}</div></section>
}

function Quizzes({ data, onAddQuestion, onRemoveQuestion, onAnswerQuestion }: { data: PlannerData; onAddQuestion: (topicId: string, prompt: string, options: string[], answer: string) => Promise<unknown>; onRemoveQuestion: (id: string) => Promise<unknown>; onAnswerQuestion: (questionId: string, selected: string) => Promise<{ correct: boolean; correctAnswer: string }> }) {
  const [isCreating, setIsCreating] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; correctAnswer: string } | null>(null)
  const [isAnswering, setIsAnswering] = useState(false)
  const [quizError, setQuizError] = useState('')
  const [topicId, setTopicId] = useState(data.subjects.flatMap((subject) => subject.topics)[0]?.id ?? '')
  const topics = data.subjects.flatMap((subject) => subject.topics.map((topic) => ({ ...topic, subjectName: subject.name })))
  const question = data.questions.find((item) => item.id === activeQuestion)

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const options = [1, 2, 3, 4].map((index) => String(form.get(`option-${index}`) ?? '').trim()).filter(Boolean)
    const prompt = String(form.get('prompt') ?? '').trim()
    const answer = String(form.get('answer') ?? '')
    if (!topicId || !prompt || options.length < 2 || !answer) return
    const saved = await onAddQuestion(topicId, prompt, options, answer)
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
      setAnswerResult(await onAnswerQuestion(question.id, selectedAnswer))
      setRevealed(true)
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Could not submit your answer')
    } finally {
      setIsAnswering(false)
    }
  }

  async function deleteQuestion(questionId: string) {
    const deleted = await onRemoveQuestion(questionId)
    if (!deleted) return
    if (activeQuestion === questionId) chooseQuestion('')
  }

  return <section className="quiz-page"><div className="quiz-intro"><div className="quiz-icon"><CircleHelp size={21} /></div><div><span className="section-kicker">ACTIVE RECALL</span><h2>Make the questions yourself.</h2><p>Writing a question is part of learning it. Save a few here, then quiz yourself whenever you have a moment.</p></div><button className="button button-dark" onClick={() => setIsCreating((current) => !current)} disabled={!topics.length}><Plus size={16} /> Write a question</button></div><div className="quiz-workspace"><div className="question-bank"><div className="panel-toolbar"><div><h2>Question bank <span className="subtle-count">{data.questions.length}</span></h2><p>Synced with database</p></div></div>{data.questions.length ? <div className="question-list">{data.questions.map((item) => { const topic = topics.find((entry) => entry.id === item.topicId); return <div className={`question-bank-item ${activeQuestion === item.id ? 'selected' : ''}`} key={item.id}><button onClick={() => chooseQuestion(item.id)}><span className="question-topic">{topic?.subjectName ?? item.subjectName}</span><strong>{item.prompt}</strong><span>{topic?.name ?? item.topicName} · {item.options.length} choices</span></button><button className="icon-button small-icon danger-icon" aria-label="Delete question" onClick={() => void deleteQuestion(item.id)}><Trash2 size={15} /></button></div> })}</div> : <div className="question-empty"><div className="empty-icon"><CircleHelp size={22} /></div><strong>Your question bank is empty</strong><span>Add a question from one of your topics to start practicing.</span><button className="text-button" disabled={!topics.length} onClick={() => setIsCreating(true)}>Write the first one <ArrowRight size={14} /></button></div>}</div>
      <div className="quiz-card">{isCreating ? <form className="question-form" onSubmit={handleCreate}><div className="panel-toolbar"><div><span className="section-kicker">NEW QUESTION</span><h2>Write a prompt</h2></div><button type="button" className="icon-button" aria-label="Close form" onClick={() => setIsCreating(false)}><X size={17} /></button></div><label className="form-label">Topic<select value={topicId} onChange={(event) => setTopicId(event.target.value)} required>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.subjectName} / {topic.name}</option>)}</select></label><label className="form-label">Question<textarea name="prompt" placeholder="What do you want to remember?" rows={3} required /></label><div className="options-label">ANSWER CHOICES</div><div className="option-inputs">{[1, 2, 3, 4].map((index) => <label className="option-input" key={index}><span>{String.fromCharCode(64 + index)}</span><input name={`option-${index}`} placeholder={`Choice ${index}`} required={index < 3} /></label>)}</div><label className="form-label">Correct answer<select name="answer" required defaultValue=""><option value="" disabled>Select a choice</option>{[1, 2, 3, 4].map((index) => <option key={index} value={String.fromCharCode(64 + index)}>Choice {String.fromCharCode(64 + index)}</option>)}</select></label><div className="form-actions"><button type="button" className="button button-outline" onClick={() => setIsCreating(false)}>Cancel</button><button className="button button-lime" type="submit"><Check size={15} /> Save question</button></div></form> : question ? <div className="quiz-play"><div className="quiz-play-meta"><span className="section-kicker">QUICK PRACTICE</span><span>{question.topicName}</span></div><h2>{question.prompt}</h2><div className="quiz-options">{question.options.map((option, index) => { const key = String.fromCharCode(65 + index); const isCorrect = revealed && key === answerResult?.correctAnswer; const isWrong = revealed && key === selectedAnswer && key !== answerResult?.correctAnswer; return <button key={key} className={`quiz-option ${selectedAnswer === key ? 'chosen' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`} onClick={() => !revealed && setSelectedAnswer(key)}><span>{key}</span>{option}{isCorrect && <CheckCircle2 size={17} />}{isWrong && <X size={17} />}</button> })}</div>{quizError && <div className="answer-feedback feedback-wrong" role="alert">{quizError}</div>}{revealed && answerResult ? <div className={`answer-feedback ${answerResult.correct ? 'feedback-correct' : 'feedback-wrong'}`}>{answerResult.correct ? 'That’s right. Nice recall.' : `Not quite. The correct answer is ${answerResult.correctAnswer}.`}</div> : <button className="button button-dark check-answer" disabled={!selectedAnswer || isAnswering} onClick={() => void submitAnswer()}>{isAnswering ? 'Saving answer…' : 'Check answer'} <ArrowRight size={15} /></button>}</div> : <div className="quiz-placeholder"><div className="quiz-deco"><div className="deco-note"><span /><span /><span /></div><div className="deco-star"><Sparkles size={19} /></div></div><span className="section-kicker">A SMALL PRACTICE, A BIG DIFFERENCE</span><h2>Bring one idea<br />back to mind.</h2><p>Select a question on the left, or write one from a topic you’re studying.</p><div className="quiz-tip"><Target size={17} /><span>Try answering from memory before you look at your notes.</span></div></div>}</div></div></section>
}

function SubjectModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (name: string, examDate: string) => void }) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const examDate = String(form.get('examDate') ?? '')
    if (name && examDate) onSubmit(name, examDate)
  }
  return <Modal title="Add a subject" subtitle="Start with the course and its next exam date." onClose={onClose}><form className="modal-form" onSubmit={handleSubmit}><label className="form-label">Subject name<input name="name" placeholder="e.g. Organic Chemistry" autoFocus required /></label><label className="form-label">Exam date<input name="examDate" type="date" min={dateKey(new Date())} required /></label><div className="form-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-lime" type="submit"><Plus size={15} /> Add subject</button></div></form></Modal>
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
  return <Modal title="Add a topic" subtitle="Break your subject into something you can tackle." onClose={onClose}><form className="modal-form" onSubmit={handleSubmit}><label className="form-label">Topic name<input name="name" placeholder="e.g. Reaction mechanisms" autoFocus required /></label><div className="form-row"><label className="form-label">Difficulty<select name="difficulty" defaultValue="Medium"><option>Easy</option><option>Medium</option><option>Hard</option></select></label><label className="form-label">Est. hours<input name="hours" type="number" min="0.5" step="0.5" defaultValue="1" required /></label></div><div className="form-actions"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-lime" type="submit"><Plus size={15} /> Add topic</button></div></form></Modal>
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>{children}</section></div>
}

export default App
