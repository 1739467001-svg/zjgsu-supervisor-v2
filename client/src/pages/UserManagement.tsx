import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Users, Shield, GraduationCap, Building2, User } from "lucide-react";

const ROLE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  supervisor_expert: { label: "督导专家", icon: <GraduationCap className="w-3.5 h-3.5" />, color: "oklch(0.35 0.13 245)", bg: "oklch(0.93 0.018 240)" },
  supervisor_leader: { label: "督导组长", icon: <Shield className="w-3.5 h-3.5" />, color: "oklch(0.42 0.14 160)", bg: "oklch(0.93 0.018 160)" },
  college_secretary: { label: "学院教学秘书", icon: <Building2 className="w-3.5 h-3.5" />, color: "oklch(0.55 0.14 85)", bg: "oklch(0.95 0.02 85)" },
  graduate_admin: { label: "研究生院主管", icon: <Users className="w-3.5 h-3.5" />, color: "oklch(0.55 0.14 300)", bg: "oklch(0.95 0.02 300)" },
  admin: { label: "系统管理员", icon: <Shield className="w-3.5 h-3.5" />, color: "oklch(0.55 0.14 30)", bg: "oklch(0.95 0.02 30)" },
  user: { label: "普通用户", icon: <User className="w-3.5 h-3.5" />, color: "oklch(0.52 0.025 240)", bg: "oklch(0.93 0.01 240)" },
};

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.users.list.useQuery();

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("角色已更新");
      utils.users.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = users?.filter((u) => {
    const matchSearch = !search || u.name?.includes(search) || u.employeeId?.includes(search) || u.college?.includes(search);
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  }) || [];

  const roleCounts = users?.reduce((acc, u) => {
    acc[u.role || "user"] = (acc[u.role || "user"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-5 page-transition">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "oklch(0.18 0.025 240)" }}>用户管理</h1>
          <p className="text-sm mt-0.5" style={{ color: "oklch(0.52 0.025 240)" }}>管理系统用户角色与权限</p>
        </div>

        {/* 角色统计 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(ROLE_CONFIG).filter(([k]) => k !== "user" && k !== "admin").map(([role, config]) => (
            <div key={role} className="bg-white rounded-xl p-4" style={{ border: "1px solid oklch(0.90 0.01 240)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: config.bg, color: config.color }}>
                  {config.icon}
                </div>
              </div>
              <div className="text-xl font-bold" style={{ color: "oklch(0.18 0.025 240)" }}>{roleCounts[role] || 0}</div>
              <div className="text-xs mt-0.5" style={{ color: "oklch(0.52 0.025 240)" }}>{config.label}</div>
            </div>
          ))}
        </div>

        {/* 筛选 */}
        <div className="bg-white rounded-xl p-4" style={{ border: "1px solid oklch(0.90 0.01 240)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="搜索姓名/工号/学院" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-xs" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="角色筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部角色</SelectItem>
                {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                  <SelectItem key={role} value={role}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 用户列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.90 0.01 240)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "oklch(0.97 0.004 240)", borderBottom: "1px solid oklch(0.90 0.01 240)" }}>
                    {["姓名", "工号", "学院", "联系方式", "角色", "操作"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "oklch(0.52 0.025 240)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const roleConf = ROLE_CONFIG[user.role || "user"] || ROLE_CONFIG.user;
                    return (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: "1px solid oklch(0.93 0.006 240)" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "oklch(0.20 0.025 240)" }}>{user.name}</td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: "oklch(0.52 0.025 240)" }}>{user.employeeId}</td>
                        <td className="px-4 py-3 text-xs max-w-[140px] truncate" style={{ color: "oklch(0.52 0.025 240)" }}>{user.college || "-"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "oklch(0.52 0.025 240)" }}>{user.phone || "-"}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: roleConf.bg, color: roleConf.color }}>
                            {roleConf.icon}{roleConf.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={user.role || "user"}
                            onValueChange={(newRole) => updateRoleMutation.mutate({ userId: user.id, role: newRole as any })}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                                <SelectItem key={role} value={role} className="text-xs">{config.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 text-xs" style={{ color: "oklch(0.52 0.025 240)", borderTop: "1px solid oklch(0.90 0.01 240)" }}>
              共 {filtered.length} 位用户
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
