
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/card";
import { Progress } from "@/components/progress";
import {
  BookOpen,
  ShieldCheck,
  ClipboardList,
  Users,
  Award,
  Activity,
  Target,
  Lightbulb,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  PlayCircle,
} from "lucide-react";

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    /*          STEP 1: Welcome   */
    {
      title: "Welcome to MediLearn",
      subtitle: "A simple, modern platform for essential healthcare training",
      content: (
        <div className="space-y-6 text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500">
            <ShieldCheck className="h-12 w-12 text-white" />
          </div>

          <h3 className="text-xl font-semibold text-gray-900">
            Learn mandatory topics with bite-sized lessons, adaptive quizzes, and clear progress.
          </h3>

          <div className="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
            <FeaturePill
              icon={<BookOpen className="h-5 w-5" />}
              title="Role-based modules"
              text="Paths for cleaners, catering staff, HCAs and more."
              bg="bg-indigo-50"
              fg="text-indigo-700"
            />
            <FeaturePill
              icon={<ClipboardList className="h-5 w-5" />}
              title="Adaptive quizzes"
              text="Smart question sets that reinforce what you need most."
              bg="bg-emerald-50"
              fg="text-emerald-700"
            />
            <FeaturePill
              icon={<Activity className="h-5 w-5" />}
              title="Progress & XP"
              text="Earn XP, badges and track streaks as you learn."
              bg="bg-amber-50"
              fg="text-amber-700"
            />
            <FeaturePill
              icon={<Users className="h-5 w-5" />}
              title="Admin friendly"
              text="Upload PDFs, auto-generate lessons & monitor analytics."
              bg="bg-sky-50"
              fg="text-sky-700"
            />
          </div>
        </div>
      ),
    },

    /*   STEP 2: Learn   */
    {
      title: "How MediLearn Works",
      subtitle: "From onboarding to certification in four simple steps",
      content: (
        <div className="space-y-8">
          <HowItWorksStep
            number="1"
            badge="Start"
            title="Create your profile"
            text="Pick your role (Cleaner, Catering Staff, HCA, etc.) so modules are tailored to you."
          />
          <HowItWorksStep
            number="2"
            badge="Learn"
            title="Learn with short, clear lessons"
            text="Concise modules written in simple language with visuals and examples."
          />
          <HowItWorksStep
            number="3"
            badge="Quiz"
            title="Test yourself with adaptive quizzes"
            text="Short quizzes with multiple choice, true/false, and scenarios help confirm learning and keep you engaged."
          />
          <HowItWorksStep
            number="4"
            badge="Apply & Earn"
            title="Apply on the job and earn badges"
            text="Put knowledge into practice, unlock the next module, and collect badges/XP as proof of progress."
          />
        </div>
      ),
    },

    /*   STEP 3: Core topics   */
    {
      title: "Core Topics You’ll Cover",
      subtitle: "Mapped to typical NHS/healthcare ‘mandatory’ basics",
      content: (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TopicCard title="Infection Control & Hand Hygiene" points={["5 moments of hand hygiene", "PPE basics & donning/doffing", "Isolation & cleaning routines"]} />
          <TopicCard title="Fire Safety" points={["R.A.C.E & P.A.S.S basics", "Evacuation protocols", "Reporting hazards"]} />
          <TopicCard title="Safeguarding" points={["Recognising abuse indicators", "Reporting concerns", "Duty of care"]} />
          <TopicCard title="Manual Handling" points={["Risk assessment basics", "Safe lifting principles", "Use of aids & team moves"]} />
          <TopicCard title="Data Protection (GDPR)" points={["Handling personal data", "Confidentiality", "Do’s & don’ts"]} />
          <TopicCard title="Basic Life Support awareness" points={["DRSABC overview", "CPR awareness", "AED awareness & calling for help"]} />
          <TopicCard title="Patient Safety & Communication" points={["Clear communication", "Incident reporting", "Escalation pathways"]} />
          <TopicCard title="Site Rules for Support Staff" points={["Housekeeping & catering hygiene", "Waste segregation", "Spill response basics"]} />
          <TopicCard
            title="Digital & Professional Skills"
            points={[
              "Safe use of e-learning and hospital IT systems",
              "Email and data etiquette",
              "Professional behaviour & teamwork",
            ]}
          />
        </div>
      ),
    },

    /*   STEP 4: Tips   */
    {
      title: "Smart Learning Tips",
      subtitle: "Get the most from quizzes and streaks",
      content: (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <TipCard
            icon={<Target className="h-5 w-5" />}
            title="Focus on weak spots"
            text="If you miss a question, you’ll see variations until it sticks."
          />
          <TipCard
            icon={<Lightbulb className="h-5 w-5" />}
            title="Unlock as you master"
            text="Modules unlock after you pass—so learning stays structured."
          />
          <TipCard
            icon={<Award className="h-5 w-5" />}
            title="Keep your streak"
            text="Return daily for quick wins—streaks boost motivation."
          />
        </div>
      ),
    },

    /*   STEP 5: Do's & Don'ts   */
    {
      title: "Do’s & Don’ts",
      subtitle: "A quick guide to get started smoothly",
      content: (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <p className="text-gray-700">Use a modern browser (Chrome/Edge) for best experience.</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <p className="text-gray-700">Turn on sound if your lesson has audio hints.</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <p className="text-gray-700">Complete modules in order to unlock new topics.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              <p className="text-gray-700">Don’t skip explanations—those are your quick wins.</p>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              <p className="text-gray-700">Don’t share login details or learner data.</p>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              <p className="text-gray-700">Don’t rely on memory alone—revisit weak areas.</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) setCurrentStep((s) => s + 1);
    else navigate("/dashboard");
  };
  const prevStep = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
    };
  const skipToApp = () => navigate("/dashboard");

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-sky-50 to-violet-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center">
            <div className="mr-2 text-3xl">🩺</div>
            <h1 className="text-2xl font-bold text-gray-900">MediLearn</h1>
          </div>

          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Getting Started</span>
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <Button variant="ghost" onClick={skipToApp} className="text-gray-500 hover:text-gray-700">
            Skip intro →
          </Button>
        </div>

        {/* Card */}
        <Card className="mb-8">
          <CardHeader className="text-center">
            <CardTitle className="mb-2 text-2xl">{steps[currentStep].title}</CardTitle>
            <p className="text-gray-600">{steps[currentStep].subtitle}</p>
          </CardHeader>
          <CardContent className="py-8">{steps[currentStep].content}</CardContent>
        </Card>

        {/* Footer nav */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Previous</span>
          </Button>

          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-full ${i <= currentStep ? "bg-indigo-600" : "bg-gray-200"}`}
              />
            ))}
          </div>

          <Button onClick={nextStep} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
            {currentStep === steps.length - 1 ? (
              <>
                <span>Start Learning</span>
                <PlayCircle className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>Next</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/*   Subcomponents   */

function FeaturePill({ icon, title, text, bg, fg }) {
  return (
    <div className={`rounded-lg p-4 ${bg}`}>
      <div className={`mb-2 inline-flex items-center gap-2 ${fg}`}>
        {icon}
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-sm text-gray-700">{text}</p>
    </div>
  );
}

function HowItWorksStep({ number, badge, title, text }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
        {number}
      </div>
      <div>
        <div className="mb-1 inline-flex items-center gap-2">
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {badge}
          </span>
          <h4 className="font-semibold text-gray-900">{title}</h4>
        </div>
        <p className="text-gray-700">{text}</p>
      </div>
    </div>
  );
}

function TopicCard({ title, points = [] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-indigo-600" />
        <h4 className="font-semibold text-gray-900">{title}</h4>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-gray-700">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TipCard({ icon, title, text }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-indigo-700">
        {icon}
        <h4 className="font-semibold text-gray-900">{title}</h4>
      </div>
      <p className="text-gray-700 text-sm">{text}</p>
    </div>
  );
}
