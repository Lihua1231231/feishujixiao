export type PreviewRole = "EMPLOYEE" | "SUPERVISOR" | "ADMIN";

const VALID_PREVIEW_ROLES: PreviewRole[] = ["EMPLOYEE", "SUPERVISOR", "ADMIN"];

export function isPreviewMode(searchParams: URLSearchParams): boolean {
  const preview = searchParams.get("preview");
  return preview !== null && VALID_PREVIEW_ROLES.includes(preview as PreviewRole);
}

export function getPreviewRole(searchParams: URLSearchParams): PreviewRole | null {
  const preview = searchParams.get("preview");
  if (preview && VALID_PREVIEW_ROLES.includes(preview as PreviewRole)) {
    return preview as PreviewRole;
  }
  return null;
}

export const PREVIEW_ROLE_LABELS: Record<PreviewRole, string> = {
  EMPLOYEE: "员工",
  SUPERVISOR: "主管",
  ADMIN: "管理员",
};

// ============================================================
// 模拟数据
// ============================================================

export function getPreviewData(role: PreviewRole, page: string): Record<string, unknown> {
  const dataMap: Record<string, Record<string, Record<string, unknown>>> = {
    dashboard: {
      EMPLOYEE: {
        user: { name: "李明", role: "EMPLOYEE" },
        cycle: {
          name: "2025年下半年绩效考核",
          status: "PEER_REVIEW",
        },
        selfEvalStatus: "SUBMITTED",
        pendingPeerReviews: 2,
        pendingTeamEvals: 0,
        hasAppeal: true,
      },
      SUPERVISOR: {
        user: { name: "王芳", role: "SUPERVISOR" },
        cycle: {
          name: "2025年下半年绩效考核",
          status: "SUPERVISOR_EVAL",
        },
        selfEvalStatus: "SUBMITTED",
        pendingPeerReviews: 1,
        pendingTeamEvals: 5,
        hasAppeal: true,
      },
      ADMIN: {
        user: { name: "赵敏", role: "ADMIN" },
        cycle: {
          name: "2025年下半年绩效考核",
          status: "CALIBRATION",
        },
        selfEvalStatus: "SUBMITTED",
        pendingPeerReviews: 0,
        pendingTeamEvals: 3,
        hasAppeal: true,
      },
    },

    "self-eval": {
      EMPLOYEE: {
        importedContent:
          "一、本周期核心成果\n\n1. 完成了用户增长平台 v2.0 的全部前端开发，DAU 提升 23%\n2. 主导设计了新的 A/B 测试框架，支持多维度对比实验\n3. 优化了首页加载性能，LCP 从 3.2s 降低到 1.1s\n\n二、协作与沟通\n\n积极参与跨部门需求评审，与产品、设计、后端团队保持高效协作。本周期共参与 12 次跨团队会议，推动 3 个跨部门项目落地。\n\n三、价值观践行\n\n坚持 ROOT 文化，主动分享技术经验，在团队内开展 2 次技术分享。积极拥抱 AI 工具，使用 Cursor 和 Claude 提升编码效率约 40%。",
        importedAt: "2026-03-18T10:30:00Z",
        sourceUrl: "https://deepwisdom.feishu.cn/wiki/example",
        status: "SUBMITTED",
      },
      SUPERVISOR: {
        viewType: "supervisor",
        message: "主管视角：可查看下属已提交的自评内容，但无需填写自评表单。",
        employees: [
          {
            name: "李明",
            department: "前端开发",
            status: "SUBMITTED",
            importedContent: "一、本周期核心成果\n\n1. 完成用户增长平台 v2.0 前端开发，DAU 提升 23%。\n2. 主导设计了新的 A/B 测试框架，支持多维度对比实验。\n3. 优化了首页加载性能，LCP 从 3.2s 降低到 1.1s。\n\n二、协作与沟通\n\n积极参与跨部门需求评审，与产品、设计、后端团队保持高效协作。\n\n三、价值观践行\n\n坚持 ROOT 文化，主动分享技术经验，在团队内开展 2 次技术分享。",
          },
          {
            name: "张伟",
            department: "产品部",
            status: "SUBMITTED",
            importedContent: "一、本周期核心成果\n\n1. 完成了 3 个核心功能的产品方案设计与上线。\n2. 推动用户反馈机制优化，NPS 提升 15 分。\n\n二、协作与沟通\n\n与技术、设计团队紧密配合，确保产品按期交付。\n\n三、价值观践行\n\n积极推动数据驱动决策，建立产品数据看板。",
          },
          {
            name: "陈静",
            department: "设计部",
            status: "DRAFT",
            importedContent: "",
          },
        ],
      },
      ADMIN: {
        viewType: "admin",
        message: "管理员视角：可查看所有员工的自评提交状态和内容汇总。",
      },
    },

    "peer-review": {
      EMPLOYEE: {
        reviews: [
          {
            id: "pr-1",
            reviewee: { id: "u-2", name: "张伟", department: "产品部" },
            outputScore: 4,
            outputComment: "产品规划清晰，交付节奏稳定",
            collaborationScore: 5,
            collaborationComment: "跨团队沟通非常顺畅",
            valuesScore: 4,
            valuesComment: "积极践行 ROOT 文化",
            innovationScore: null,
            innovationComment: "",
            declinedAt: null,
            declineReason: "",
            status: "DRAFT",
          },
          {
            id: "pr-2",
            reviewee: { id: "u-3", name: "陈静", department: "设计部" },
            outputScore: null,
            outputComment: "",
            collaborationScore: null,
            collaborationComment: "",
            valuesScore: null,
            valuesComment: "",
            innovationScore: null,
            innovationComment: "",
            declinedAt: null,
            declineReason: "",
            status: "DRAFT",
          },
        ],
        nominations: [
          {
            id: "nom-1",
            nominee: { id: "u-4", name: "刘洋", department: "后端开发" },
            supervisorStatus: "APPROVED",
            nomineeStatus: "ACCEPTED",
          },
          {
            id: "nom-2",
            nominee: { id: "u-5", name: "赵雪", department: "QA" },
            supervisorStatus: "APPROVED",
            nomineeStatus: "PENDING",
          },
          {
            id: "nom-3",
            nominee: { id: "u-6", name: "孙磊", department: "运维" },
            supervisorStatus: "PENDING",
            nomineeStatus: "PENDING",
          },
        ],
      },
      SUPERVISOR: {
        reviews: [],
        nominations: [],
        confirmNominations: [
          {
            id: "cn-1",
            nominator: { id: "u-7", name: "周婷", department: "前端开发" },
            nominee: { id: "u-8", name: "吴强", department: "后端开发" },
            supervisorStatus: "PENDING",
          },
          {
            id: "cn-2",
            nominator: { id: "u-7", name: "周婷", department: "前端开发" },
            nominee: { id: "u-9", name: "郑丽", department: "产品部" },
            supervisorStatus: "APPROVED",
          },
        ],
      },
      ADMIN: {
        reviews: [],
        nominations: [],
      },
    },

    team: {
      EMPLOYEE: {},
      SUPERVISOR: {
        evals: [
          {
            employee: { id: "e-1", name: "李明", department: "前端开发", jobTitle: "高级工程师" },
            evaluation: { id: "ev-1", performanceStars: 4, performanceComment: "产出质量高", abilityStars: 4, abilityComment: "学习能力强", valuesStars: 3, valuesComment: "价值观践行良好", weightedScore: 3.8, status: "DRAFT" },
            selfEval: { status: "SUBMITTED", importedContent: "完成用户增长平台 v2.0 前端开发，DAU 提升 23%..." },
            peerReviewSummary: { output: 4.2, collaboration: 4.5, values: 4.0, count: 3 },
          },
          {
            employee: { id: "e-2", name: "张伟", department: "产品部", jobTitle: "产品经理" },
            evaluation: null,
            selfEval: { status: "SUBMITTED", importedContent: "主导完成 3 个核心产品迭代，用户满意度提升 15%..." },
            peerReviewSummary: { output: 3.8, collaboration: 4.0, values: 3.5, count: 4 },
          },
          {
            employee: { id: "e-3", name: "陈静", department: "设计部", jobTitle: "UI设计师" },
            evaluation: { id: "ev-3", performanceStars: 5, performanceComment: "设计质量卓越", abilityStars: 4, abilityComment: "专业能力突出", valuesStars: 5, valuesComment: "团队标杆", weightedScore: 4.7, status: "SUBMITTED" },
            selfEval: { status: "SUBMITTED", importedContent: "完成 20+ 页面设计，建立统一设计规范..." },
            peerReviewSummary: { output: 4.5, collaboration: 4.8, values: 4.6, count: 5 },
          },
          {
            employee: { id: "e-4", name: "刘洋", department: "后端开发", jobTitle: "工程师" },
            evaluation: null,
            selfEval: null,
            peerReviewSummary: null,
          },
          {
            employee: { id: "e-5", name: "赵雪", department: "QA", jobTitle: "测试工程师" },
            evaluation: null,
            selfEval: { status: "SUBMITTED", importedContent: "建立自动化测试体系，覆盖率从 45% 提升到 82%..." },
            peerReviewSummary: { output: 3.5, collaboration: 4.2, values: 3.8, count: 3 },
          },
        ],
        nominations: [
          {
            id: "tn-1",
            nominator: { id: "e-1", name: "李明", department: "前端开发" },
            nominee: { id: "e-4", name: "刘洋", department: "后端开发" },
            supervisorStatus: "PENDING",
          },
        ],
      },
      ADMIN: {
        evals: [],
        nominations: [],
      },
    },

    calibration: {
      EMPLOYEE: {},
      SUPERVISOR: {},
      ADMIN: {
        data: [
          { user: { id: "c-1", name: "李明", department: "前端开发", jobTitle: "高级工程师" }, selfEvalStatus: "imported", peerAvg: "4.2", supervisorWeighted: 3.8, proposedStars: 4, finalStars: null },
          { user: { id: "c-2", name: "张伟", department: "产品部", jobTitle: "产品经理" }, selfEvalStatus: "imported", peerAvg: "3.8", supervisorWeighted: 3.5, proposedStars: 3, finalStars: 3 },
          { user: { id: "c-3", name: "陈静", department: "设计部", jobTitle: "UI设计师" }, selfEvalStatus: "imported", peerAvg: "4.6", supervisorWeighted: 4.7, proposedStars: 5, finalStars: 5 },
          { user: { id: "c-4", name: "刘洋", department: "后端开发", jobTitle: "工程师" }, selfEvalStatus: "not_imported", peerAvg: null, supervisorWeighted: null, proposedStars: null, finalStars: null },
          { user: { id: "c-5", name: "赵雪", department: "QA", jobTitle: "测试工程师" }, selfEvalStatus: "imported", peerAvg: "3.8", supervisorWeighted: 3.6, proposedStars: 3, finalStars: null },
          { user: { id: "c-6", name: "孙磊", department: "运维", jobTitle: "运维工程师" }, selfEvalStatus: "imported", peerAvg: "3.2", supervisorWeighted: 3.0, proposedStars: 3, finalStars: 3 },
          { user: { id: "c-7", name: "周婷", department: "前端开发", jobTitle: "初级工程师" }, selfEvalStatus: "imported", peerAvg: "3.5", supervisorWeighted: 3.2, proposedStars: 3, finalStars: null },
          { user: { id: "c-8", name: "吴强", department: "后端开发", jobTitle: "高级工程师" }, selfEvalStatus: "imported", peerAvg: "4.0", supervisorWeighted: 4.2, proposedStars: 4, finalStars: 4 },
          { user: { id: "c-9", name: "郑丽", department: "产品部", jobTitle: "产品经理" }, selfEvalStatus: "imported", peerAvg: "2.8", supervisorWeighted: 2.5, proposedStars: 2, finalStars: null },
          { user: { id: "c-10", name: "王涛", department: "前端开发", jobTitle: "工程师" }, selfEvalStatus: "imported", peerAvg: "1.8", supervisorWeighted: 1.5, proposedStars: 1, finalStars: 1 },
        ],
      },
    },

    admin: {
      EMPLOYEE: {},
      SUPERVISOR: {},
      ADMIN: {
        cycles: [
          {
            id: "cycle-1",
            name: "2025年下半年绩效考核",
            status: "CALIBRATION",
            selfEvalStart: "2026-03-17",
            selfEvalEnd: "2026-03-24",
            peerReviewStart: "2026-03-24",
            peerReviewEnd: "2026-03-27",
            supervisorStart: "2026-03-24",
            supervisorEnd: "2026-03-27",
            calibrationStart: "2026-03-27",
            calibrationEnd: "2026-03-30",
            meetingStart: "2026-03-30",
            meetingEnd: "2026-04-01",
            appealStart: "2026-04-01",
            appealEnd: "2026-04-04",
          },
        ],
        users: [
          { id: "u-1", name: "李明", email: "liming@example.com", department: "前端开发", jobTitle: "高级工程师", role: "EMPLOYEE", supervisor: { id: "u-s1", name: "王芳" } },
          { id: "u-2", name: "张伟", email: "zhangwei@example.com", department: "产品部", jobTitle: "产品经理", role: "EMPLOYEE", supervisor: { id: "u-s1", name: "王芳" } },
          { id: "u-3", name: "陈静", email: "chenjing@example.com", department: "设计部", jobTitle: "UI设计师", role: "EMPLOYEE", supervisor: { id: "u-s2", name: "赵敏" } },
          { id: "u-4", name: "王芳", email: "wangfang@example.com", department: "技术部", jobTitle: "技术总监", role: "SUPERVISOR", supervisor: null },
          { id: "u-5", name: "赵敏", email: "zhaomin@example.com", department: "HR", jobTitle: "HR总监", role: "ADMIN", supervisor: null },
        ],
      },
    },
    appeal: {
      EMPLOYEE: {
        appeals: [
          {
            id: "appeal-1",
            cycleId: "cycle-1",
            userId: "u-1",
            reason: "我认为本周期的360环评结果未能充分反映我在跨部门项目中的贡献，特别是用户增长平台v2.0项目中我承担了主要的技术方案设计和实施工作。",
            status: "PENDING",
            resolution: "",
            handledBy: null,
            handledAt: null,
            createdAt: "2026-04-01T14:30:00Z",
          },
        ],
        cycle: {
          id: "cycle-1",
          name: "2025年下半年绩效考核",
          status: "APPEAL",
          appealStart: "2026-04-01",
          appealEnd: "2026-04-04",
        },
        finalStars: 3,
        role: "EMPLOYEE",
      },
      SUPERVISOR: {
        appeals: [],
        cycle: {
          id: "cycle-1",
          name: "2025年下半年绩效考核",
          status: "APPEAL",
          appealStart: "2026-04-01",
          appealEnd: "2026-04-04",
        },
        finalStars: null,
        role: "SUPERVISOR",
      },
      ADMIN: {
        appeals: [
          {
            id: "appeal-a1",
            cycleId: "cycle-1",
            userId: "u-1",
            reason: "360环评结果未能反映跨部门项目贡献，用户增长平台v2.0项目中承担了主要技术方案设计工作。",
            status: "PENDING",
            resolution: "",
            handledBy: null,
            handledAt: null,
            createdAt: "2026-04-01T14:30:00Z",
            user: { id: "u-1", name: "李明", department: "前端开发" },
            finalStars: 3,
          },
          {
            id: "appeal-a2",
            cycleId: "cycle-1",
            userId: "u-7",
            reason: "上级初评分数与360环评差异较大，希望能重新审核评估过程。",
            status: "PENDING",
            resolution: "",
            handledBy: null,
            handledAt: null,
            createdAt: "2026-04-02T09:15:00Z",
            user: { id: "u-7", name: "周婷", department: "前端开发" },
            finalStars: 2,
          },
          {
            id: "appeal-a3",
            cycleId: "cycle-1",
            userId: "u-9",
            reason: "本周期承担了两个核心产品线的迭代工作，工作量远超预期，但评分未体现。",
            status: "PENDING",
            resolution: "",
            handledBy: null,
            handledAt: null,
            createdAt: "2026-04-02T11:00:00Z",
            user: { id: "u-9", name: "郑丽", department: "产品部" },
            finalStars: 2,
          },
        ],
        cycle: {
          id: "cycle-1",
          name: "2025年下半年绩效考核",
          status: "APPEAL",
          appealStart: "2026-04-01",
          appealEnd: "2026-04-04",
        },
        finalStars: null,
        role: "ADMIN",
      },
    },

    meetings: {
      EMPLOYEE: {
        meetings: [],
      },
      SUPERVISOR: {
        meetings: [
          {
            id: "mt-1",
            employee: { id: "e-1", name: "李明", department: "前端开发" },
            meetingDate: "2026-03-31T10:00:00Z",
            notes: "绩效表现良好，DAU提升23%成绩显著。建议下个周期加强跨团队协作能力，尝试承担更多技术分享。员工对结果无异议。",
            employeeAck: true,
          },
          {
            id: "mt-2",
            employee: { id: "e-2", name: "张伟", department: "产品部" },
            meetingDate: null,
            notes: "",
            employeeAck: false,
          },
          {
            id: "mt-3",
            employee: { id: "e-3", name: "陈静", department: "设计部" },
            meetingDate: null,
            notes: "",
            employeeAck: false,
          },
        ],
      },
      ADMIN: {
        meetings: [
          {
            id: "mt-1",
            employee: { id: "e-1", name: "李明", department: "前端开发" },
            meetingDate: "2026-03-31T10:00:00Z",
            notes: "绩效表现良好，DAU提升23%成绩显著。建议下个周期加强跨团队协作能力。",
            employeeAck: true,
          },
          {
            id: "mt-2",
            employee: { id: "e-2", name: "张伟", department: "产品部" },
            meetingDate: null,
            notes: "",
            employeeAck: false,
          },
          {
            id: "mt-3",
            employee: { id: "e-3", name: "陈静", department: "设计部" },
            meetingDate: null,
            notes: "",
            employeeAck: false,
          },
        ],
      },
    },
  };

  return dataMap[page]?.[role] ?? {};
}
