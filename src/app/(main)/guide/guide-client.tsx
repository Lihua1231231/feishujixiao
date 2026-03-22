"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Users,
  Star,
  BarChart3,
  MessageSquare,
  Megaphone,
  ArrowRight,
  CheckCircle2,
  Settings,
  RefreshCw,
  Download,
} from "lucide-react";

export type CycleData = {
  name: string;
  status: string;
  selfEvalStart: string | null;
  selfEvalEnd: string | null;
  peerReviewStart: string | null;
  peerReviewEnd: string | null;
  supervisorStart: string | null;
  supervisorEnd: string | null;
  calibrationStart: string | null;
  calibrationEnd: string | null;
  meetingStart: string | null;
  meetingEnd: string | null;
  appealStart: string | null;
  appealEnd: string | null;
};

type Props = {
  cycle: CycleData | null;
};

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateRange(start: string | null, end: string | null): string {
  const s = formatDateShort(start);
  const e = formatDateShort(end);
  if (s && e) return `${s}-${e}`;
  if (s) return s;
  if (e) return e;
  return "";
}

type StepDef = {
  key: string;
  title: string;
  date: string;
  desc: string;
  icon: typeof ClipboardList;
};

function buildSteps(cycle: CycleData | null): StepDef[] {
  return [
    {
      key: "SELF_EVAL",
      title: "个人自评",
      date: cycle ? formatDateRange(cycle.selfEvalStart, cycle.selfEvalEnd) : "",
      desc: "通过飞书表单提交工作总结",
      icon: ClipboardList,
    },
    {
      key: "PEER_REVIEW",
      title: "360环评",
      date: cycle ? formatDateRange(cycle.peerReviewStart, cycle.peerReviewEnd) : "",
      desc: "提名评估人 & 互评同事",
      icon: Users,
    },
    {
      key: "SUPERVISOR_EVAL",
      title: "上级初评",
      date: cycle ? formatDateRange(cycle.supervisorStart, cycle.supervisorEnd) : "",
      desc: "三维度星级评估",
      icon: Star,
    },
    {
      key: "CALIBRATION",
      title: "绩效校准",
      date: cycle ? formatDateRange(cycle.calibrationStart, cycle.calibrationEnd) : "校准会后",
      desc: "公司级统一校准",
      icon: BarChart3,
    },
    {
      key: "MEETING",
      title: "绩效面谈",
      date: cycle ? formatDateRange(cycle.meetingStart, cycle.meetingEnd) : "面谈期",
      desc: "一对一绩效反馈",
      icon: MessageSquare,
    },
    {
      key: "APPEAL",
      title: "申诉窗口",
      date: cycle ? formatDateRange(cycle.appealStart, cycle.appealEnd) : "面谈后",
      desc: "对结果有异议可申诉",
      icon: Megaphone,
    },
  ];
}

const statusOrder = [
  "SELF_EVAL",
  "PEER_REVIEW",
  "SUPERVISOR_EVAL",
  "CALIBRATION",
  "MEETING",
  "APPEAL",
];

function getActiveIndex(cycleStatus: string | null): number {
  if (!cycleStatus) return 0;
  if (cycleStatus === "DRAFT") return 0;
  if (cycleStatus === "ARCHIVED") return statusOrder.length;
  const idx = statusOrder.indexOf(cycleStatus);
  return idx >= 0 ? idx : 0;
}

const ratingTable = [
  { stars: 5, label: "五星", def: "取得杰出的成果，所做的工作在世界范围拥有领先性，拥有极强的推动力，拥有显著的影响力", dist: "<=10%" },
  { stars: 4, label: "四星", def: "超出期望的成果，所做的工作在行业内具有竞争力，拥有很强的推动力，拥有一定的影响力", dist: "<=20%" },
  { stars: 3, label: "三星", def: "符合预期的成果，始终如一地完成工作职责，可以较好的完成工作落地、闭环，具有较好的学习能力，具有不错的推动力", dist: "50%+" },
  { stars: 2, label: "二星", def: "成果不达预期，需要提高。基本满足考核要求，但与他人相比不能充分执行所有的工作职责，或虽执行了职责但平均水平较低或成果较差", dist: "<=15%" },
  { stars: 1, label: "一星", def: "成果远低于预期，未达合格标准。不能证明其具备所需的知识和技能或不能利用所需的知识和技能；不能执行其工作职责", dist: "<=5%" },
];

const faqItems = [
  {
    q: "360环评是匿名的吗？",
    a: "是的，360环评采用完全匿名模式，被评估人无法看到具体是谁给出的评价。",
  },
  {
    q: "我可以拒绝评估邀请吗？",
    a: "可以，但需要说明拒绝原因。我们建议尽量接受邀请，因为360反馈对同事的成长很有价值。",
  },
  {
    q: "评估的三个维度权重是多少？",
    a: "业绩产出占50%，个人能力占30%，价值观占20%。系统会自动计算加权分。",
  },
  {
    q: "对结果有异议怎么办？",
    a: '在申诉窗口期内，可以在"绩效申诉"页面提交申诉，说明理由后由HR审核处理。',
  },
  {
    q: "自评在哪里提交？",
    a: '通过飞书多维表格提交，点击"个人自评"页面中的链接即可跳转。提交后由HR统一导入系统。',
  },
];

function StarsDisplay({ count }: { count: number }) {
  return (
    <span className="text-amber-500">
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} className="inline h-4 w-4 fill-amber-500" />
      ))}
    </span>
  );
}

function GuideCard({
  icon,
  title,
  items,
  href,
  linkText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  href: string;
  linkText: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1 space-y-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                {item}
              </li>
            ))}
          </ul>
          {children}
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
          >
            {linkText}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>
    </Card>
  );
}

function RatingTableInline() {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium">等级</th>
            <th className="px-3 py-2 text-left font-medium">定义</th>
            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">分布参考</th>
          </tr>
        </thead>
        <tbody>
          {ratingTable.map((row) => (
            <tr key={row.stars} className="border-b last:border-b-0">
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <StarsDisplay count={row.stars} />
                  <span className="font-medium">{row.label}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.def}</td>
              <td className="px-3 py-2 text-right">
                <Badge variant="secondary">{row.dist}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GuidePage({ cycle }: Props) {
  const cycleStatus = cycle?.status ?? null;
  const activeIndex = getActiveIndex(cycleStatus);
  const steps = buildSteps(cycle);

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-10">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">绩效考核使用指南</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {cycle?.name ? `${cycle.name}流程说明` : "绩效考核流程说明"}
        </p>
      </div>

      {/* Section 1: Flow Overview - Task 1: 时间线文字颜色改为蓝色系 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">流程总览</h2>
        <div className="overflow-x-auto">
          <div className="flex min-w-[720px] items-start gap-0">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isCurrent = i === activeIndex;
              const isPast = i < activeIndex;

              return (
                <div key={step.key} className="flex flex-1 flex-col items-center">
                  {/* Connector + Circle */}
                  <div className="flex w-full items-center">
                    {/* Left connector */}
                    <div
                      className={`h-0.5 flex-1 ${
                        i === 0 ? "bg-transparent" : isPast ? "bg-blue-500" : isCurrent ? "bg-blue-300" : "bg-gray-200"
                      }`}
                    />
                    {/* Circle */}
                    <div
                      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        isCurrent
                          ? "border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-100"
                          : isPast
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-gray-200 bg-white text-blue-400"
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    {/* Right connector */}
                    <div
                      className={`h-0.5 flex-1 ${
                        i === steps.length - 1
                          ? "bg-transparent"
                          : isPast
                            ? "bg-blue-500"
                            : "bg-gray-200"
                      }`}
                    />
                  </div>
                  {/* Text below */}
                  <div className="mt-3 text-center">
                    <p
                      className={`text-sm font-medium ${
                        isCurrent ? "text-blue-600" : isPast ? "text-blue-600" : "text-blue-400"
                      }`}
                    >
                      {step.title}
                    </p>
                    {isCurrent && (
                      <Badge className="mt-1 bg-blue-100 text-blue-700 text-xs">
                        进行中
                      </Badge>
                    )}
                    <p
                      className={`mt-1 text-xs ${
                        isCurrent ? "text-blue-500" : isPast ? "text-blue-500" : "text-blue-400"
                      }`}
                    >
                      {step.date}
                    </p>
                    <p
                      className={`mt-0.5 max-w-[100px] text-xs leading-tight ${
                        isCurrent ? "text-blue-500" : isPast ? "text-blue-500" : "text-blue-400"
                      }`}
                    >
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: Role Guide */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">角色操作指南</h2>
        <Tabs defaultValue="employee">
          <TabsList className="w-full">
            <TabsTrigger value="employee" className="flex-1">员工指南</TabsTrigger>
            <TabsTrigger value="supervisor" className="flex-1">主管指南</TabsTrigger>
            <TabsTrigger value="admin" className="flex-1">管理员指南</TabsTrigger>
          </TabsList>

          {/* Task 5: 删除"查看绩效结果"卡片 */}
          <TabsContent value="employee" className="mt-4 space-y-3">
            <GuideCard
              icon={<ClipboardList className="h-6 w-6 text-blue-600" />}
              title="提交个人自评"
              items={[
                "点击飞书表单链接提交你的周期工作总结",
                "支持OKR模板或自定义模板",
                "截止：3月24日",
              ]}
              href="/self-eval"
              linkText="前往提交"
            />
            <GuideCard
              icon={<Users className="h-6 w-6 text-purple-600" />}
              title="提名360评估人"
              items={[
                "选择3-5位熟悉你工作的同事",
                "需覆盖上级、平级、跨团队协作方",
                "提交后即刻生效，被提名同事可开始评估",
              ]}
              href="/peer-review"
              linkText="前往提名"
            />
            <GuideCard
              icon={<Star className="h-6 w-6 text-amber-500" />}
              title="完成360环评"
              items={[
                "对邀请你评估的同事进行打分",
                "4个维度：业绩产出、协作配合、价值观、创新（可选）",
                "评估采用匿名模式",
              ]}
              href="/peer-review"
              linkText="前往评估"
            />
            <GuideCard
              icon={<Megaphone className="h-6 w-6 text-rose-600" />}
              title="绩效申诉"
              items={[
                "对结果有异议时可在申诉窗口期提交",
                "需提供申诉理由",
              ]}
              href="/appeal"
              linkText="前往申诉"
            />
          </TabsContent>

          {/* Task 6: 删除"确认评估人提名"卡片; Task 7: 补全上级初评+绩效面谈 */}
          <TabsContent value="supervisor" className="mt-4 space-y-3">
            {/* 上级初评 - 完整信息 (Task 3+7: 含评估标准表格) */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start gap-3">
                <div className="mt-0.5">
                  <Star className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1 space-y-4">
                  <CardTitle className="text-base">上级初评</CardTitle>

                  {/* 考核原则 */}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">考核原则</p>
                    <p className="text-sm text-muted-foreground">
                      深度赋智绩效考核采用&ldquo;OKR目标牵引 + 360度综合价值评估 + 全层级绩效校准&rdquo;三位一体体系。OKR为目标管理与协同工具，不直接与绩效考核结果挂钩。绩效考核聚焦周期内员工的实际价值贡献、协作价值、战略适配度。
                    </p>
                  </div>

                  {/* 管理者导向 */}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">管理者导向</p>
                    <p className="text-sm text-muted-foreground">
                      各级管理者是团队绩效管理第一责任人；负责下属的目标对齐、双月过程辅导、绩效初评、一对一反馈沟通；组织团队内绩效复盘；举证员工绩效贡献，参与校准会；制定下属绩效改进计划，落地人才发展动作。
                    </p>
                  </div>

                  {/* 评估维度 */}
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">评估维度</p>

                    {/* 一、业绩产出 */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">一、业绩产出（50%）</p>
                      <p className="text-sm text-muted-foreground">
                        请结合员工工作总结自评 + 周期内实际产出结果 + OKR完成度 + 团队内贡献度综合评定，需提供数据/案例作证和描述。
                      </p>
                    </div>

                    {/* 二、个人能力 */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">二、个人能力（30%）</p>
                      <p className="text-sm text-muted-foreground">
                        请结合员工综合能力 + 学习能力 + 适应能力综合评定。
                      </p>

                      <div className="ml-2 space-y-2 text-sm text-muted-foreground">
                        <div>
                          <p className="font-medium text-foreground/80">综合能力：</p>
                          <p className="text-xs text-muted-foreground/80 mb-1">综合能力是人才价值交付的基本盘，是绩效持续达标的底层支撑，与岗位职级强绑定，不同职级对应明确的能力标尺，也是组织能力建设的最小单元。</p>
                          <ul className="ml-4 list-disc space-y-0.5">
                            <li>复杂问题解决与业务闭环：穿透表象抓住业务本质，以最小成本解决核心矛盾，实现从目标到结果的全链路闭环</li>
                            <li>专业纵深与角色履职：匹配岗位职级的专业硬实力，全面、稳定履行岗位职责，在专业领域形成不可替代的价值</li>
                            <li>跨边界协同与组织价值创造：在跨团队、跨职能、跨区域协作中创造增量价值，而非单纯的配合执行</li>
                            <li>团队赋能与价值带动：基于自身能力为团队/组织赋能，带动周边同事共同成长，能做到利他</li>
                            <li>vibe coding（必含，对所有岗位生效）：能通过AI-first工作方式落地，提高交付效能</li>
                            <li>领导力-基础管理执行（限Leader）：遵循[T] RFC-368-研发团队基础管理办法</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-foreground/80">学习能力：</p>
                          <p className="text-xs text-muted-foreground/80 mb-1">学习能力是员工在快速变化的业务环境中，快速获取、消化、转化新知识新方法，持续刷新认知、迭代能力，实现从「知道」到「做到」闭环的核心能力，是公司保持创新活力的核心人才特质，也是高潜人才识别、成长的关键项。</p>
                          <ul className="ml-4 list-disc space-y-0.5">
                            <li>问题分析与判断力：能抓主要矛盾，识别问题本质，在信息不完整时做出相对正确的判断，而不是停留在表面现象</li>
                            <li>推动执行力：能把目标拆解成路径、节奏、责任人和关键节点，持续推进，不拖不等不绕</li>
                            <li>主动性与批判性思考：能否基于业务实际，提出自己的独立判断与优化建议，不盲目跟风，始终基于本质思考做决策</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-foreground/80">适应能力：</p>
                          <p className="text-xs text-muted-foreground/80 mb-1">面对业务复杂性、场景变化、节奏加速、组织调整或目标切换时，能够快速调整认知、情绪、方法和资源配置，持续保持有效产出的能力。</p>
                          <ul className="ml-4 list-disc space-y-0.5">
                            <li>AI-first工作方式落地与AI-native交付这一组织转型战略的适配度</li>
                            <li>可参考主动性、自我成长、心理韧性、潜力项展开综述</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* 三、价值观 */}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">三、价值观（20%）</p>
                      <p className="text-sm text-muted-foreground">
                        请针对价值观更新：从「始终创业」到「ROOT」的组织导向升级4条进行评估。
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ROOT = Ownership、独立思考与快速学习、结果导向、Always Day 1
                      </p>
                    </div>
                  </div>

                  {/* 五星等级定义表格 (Task 3: 嵌入此处) */}
                  <RatingTableInline />

                  {/* 分布参考 */}
                  <p className="text-sm text-muted-foreground">
                    分布参考：五星≤10%，四星≤20%，三星50%+，二星≤15%，一星≤5%
                  </p>

                  {/* 初评指引 */}
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">初评指引</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        初评需严格遵循绩效等级定义与分布指导规则，不得突破比例限制
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        高绩效、低绩效评级必须提供完整的贡献举证与事实依据
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        初评结果仅为待校准状态，不得提前向员工透露
                      </li>
                    </ul>
                  </div>

                  <Link
                    href="/team"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
                  >
                    前往评估
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardHeader>
            </Card>

            {/* 绩效面谈 - 补全信息 (Task 7) */}
            <GuideCard
              icon={<MessageSquare className="h-6 w-6 text-blue-600" />}
              title="绩效面谈"
              items={[
                "与每位下属一对一面谈",
                "结合员工工作总结、360度评估反馈、周期内实际产出进行反馈",
                "记录面谈纪要",
                "员工确认面谈结果",
              ]}
              href="/meetings"
              linkText="前往面谈"
            />
          </TabsContent>

          <TabsContent value="admin" className="mt-4 space-y-3">
            <GuideCard
              icon={<Settings className="h-6 w-6 text-gray-600" />}
              title="创建考核周期"
              items={["设置各阶段时间节点"]}
              href="/admin"
              linkText="前往设置"
            />
            <GuideCard
              icon={<RefreshCw className="h-6 w-6 text-blue-600" />}
              title="同步组织架构"
              items={["从飞书导入部门和员工信息"]}
              href="/admin"
              linkText="前往同步"
            />
            <GuideCard
              icon={<Download className="h-6 w-6 text-green-600" />}
              title="导入自评数据"
              items={["从飞书多维表格批量导入"]}
              href="/admin"
              linkText="前往导入"
            />
            <GuideCard
              icon={<BarChart3 className="h-6 w-6 text-amber-600" />}
              title="绩效校准"
              items={["查看星级分布，调整最终等级"]}
              href="/calibration"
              linkText="前往校准"
            />
            <GuideCard
              icon={<Megaphone className="h-6 w-6 text-rose-600" />}
              title="处理申诉"
              items={["审核和处理员工申诉"]}
              href="/appeal"
              linkText="前往处理"
            />
          </TabsContent>
        </Tabs>
      </section>

      {/* Task 3: 独立的评估标准section已删除，表格已嵌入上级初评卡片 */}

      {/* Section 4: FAQ - Task 4: 去掉折叠，始终显示 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">常见问题</h2>
        <Card>
          <CardContent className="px-4 py-2">
            {faqItems.map((item, i) => (
              <div key={i} className="border-b last:border-b-0">
                <div className="flex items-center gap-3 py-4 text-sm font-medium">
                  <span>Q：{item.q}</span>
                </div>
                <div className="pb-4 pl-7 text-sm text-muted-foreground">
                  A：{item.a}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
