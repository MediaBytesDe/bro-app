"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  FolderTree,
} from "lucide-react";
import { toast } from "sonner";

type Category = {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
};

export default function CategoriesPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  
  // New category state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("sort_order")
        .order("name");
      
      if (data) {
        setCategories(data);
        // Expand all main categories
        const mainIds = data.filter(c => !c.parent_id).map(c => c.id);
        setExpanded(new Set(mainIds));
      }
    } catch (err) {
      console.error("Error loading categories:", err);
    } finally {
      setLoading(false);
    }
  }

  // Build recursive tree for unlimited nesting
  type CategoryNode = Category & { children: CategoryNode[] };

  const buildTree = (parentId: string | null): CategoryNode[] => {
    return categories
      .filter(c => c.parent_id === parentId)
      .filter(c => showInactive || c.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(cat => ({
        ...cat,
        children: buildTree(cat.id)
      }));
  };

  const tree = buildTree(null);

  // Render category options recursively for select dropdown with clear hierarchy
  const renderCategoryOptions = (nodes: CategoryNode[], level: number): JSX.Element[] => {
    return nodes.flatMap(node => {
      // Use different prefixes based on level for clarity
      let prefix = '';
      if (level === 0) {
        prefix = '■ '; // Main categories
      } else if (level === 1) {
        prefix = '  └─ '; // First sub-level
      } else {
        prefix = '    ' + '  '.repeat(level - 1) + '└─ '; // Deeper levels
      }

      return [
        <option key={node.id} value={node.id}>
          {prefix}{node.name}
        </option>,
        ...renderCategoryOptions(node.children, level + 1)
      ];
    });
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    
    const { error } = await supabase
      .from("product_categories")
      .update({ name: editName.trim() })
      .eq("id", id);
    
    if (error) {
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Gespeichert");
      loadCategories();
    }
    cancelEdit();
  };

  const toggleActive = async (cat: Category) => {
    const { error } = await supabase
      .from("product_categories")
      .update({ is_active: !cat.is_active })
      .eq("id", cat.id);
    
    if (error) {
      toast.error("Fehler");
    } else {
      toast.success(cat.is_active ? "Deaktiviert" : "Aktiviert");
      loadCategories();
    }
  };

  const deleteCategory = async (cat: Category) => {
    // Check if has children
    const hasChildren = categories.some(c => c.parent_id === cat.id);
    if (hasChildren) {
      toast.error("Kategorie hat Unterkategorien");
      return;
    }
    
    // Check if has products
    const { count } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", cat.id);
    
    if (count && count > 0) {
      toast.error(`Kategorie hat ${count} Artikel`);
      return;
    }
    
    if (!confirm(`"${cat.name}" wirklich löschen?`)) return;
    
    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("id", cat.id);
    
    if (error) {
      toast.error("Fehler beim Löschen");
    } else {
      toast.success("Gelöscht");
      loadCategories();
    }
  };

  const createCategory = async () => {
    if (!newName.trim()) return;
    
    // Get max sort_order
    const siblings = categories.filter(c => c.parent_id === newParentId);
    const maxSort = siblings.length > 0 
      ? Math.max(...siblings.map(c => c.sort_order)) + 1 
      : 0;
    
    const { error } = await supabase
      .from("product_categories")
      .insert({
        name: newName.trim(),
        parent_id: newParentId,
        sort_order: maxSort,
        is_active: true,
      });
    
    if (error) {
      toast.error("Fehler beim Erstellen");
    } else {
      toast.success("Kategorie erstellt");
      setNewName("");
      setNewParentId(null);
      setShowNewForm(false);
      loadCategories();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/articles")}
          className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Kategorien</h1>
          <p className="text-sm text-neutral-500">{categories.filter(c => c.is_active).length} aktiv</p>
        </div>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`p-2.5 rounded-xl transition-colors ${showInactive ? 'bg-[#fa432a]/20 text-[#fa432a]' : 'bg-neutral-800 text-neutral-400'}`}
          title={showInactive ? "Inaktive ausblenden" : "Inaktive anzeigen"}
        >
          {showInactive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        </button>
        <button
          onClick={() => setShowNewForm(true)}
          className="w-10 h-10 rounded-xl bg-[#fa432a] flex items-center justify-center text-white"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* New Category Form */}
      {showNewForm && (
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Plus className="w-4 h-4" />
            Neue Kategorie
          </div>
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm focus:outline-none focus:border-[#fa432a]/50"
            autoFocus
          />
          <select
            value={newParentId || ""}
            onChange={(e) => setNewParentId(e.target.value || null)}
            className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm focus:outline-none focus:border-[#fa432a]/50"
          >
            <option value="">-- Hauptkategorie --</option>
            {renderCategoryOptions(tree, 0)}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowNewForm(false); setNewName(""); setNewParentId(null); }}
              className="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm"
            >
              Abbrechen
            </button>
            <button
              onClick={createCategory}
              disabled={!newName.trim()}
              className="flex-1 py-2 rounded-lg bg-[#fa432a] text-white text-sm disabled:opacity-50"
            >
              Erstellen
            </button>
          </div>
        </div>
      )}

      {/* Category Tree */}
      <div className="border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
        {tree.length === 0 ? (
          <div className="p-8 text-center">
            <FolderTree className="w-10 h-10 mx-auto mb-3 text-neutral-600" />
            <p className="text-neutral-500">Keine Kategorien</p>
          </div>
        ) : (
          tree.map(node => (
            <CategoryNode
              key={node.id}
              node={node}
              level={0}
              expanded={expanded}
              toggleExpand={toggleExpand}
              editingId={editingId}
              editName={editName}
              setEditName={setEditName}
              startEdit={startEdit}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              toggleActive={toggleActive}
              deleteCategory={deleteCategory}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Recursive CategoryNode component for unlimited nesting
function CategoryNode({ node, level, expanded, toggleExpand, editingId, editName, setEditName, startEdit, saveEdit, cancelEdit, toggleActive, deleteCategory }: {
  node: Category & { children: any[] };
  level: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
  editingId: string | null;
  editName: string;
  setEditName: (name: string) => void;
  startEdit: (cat: Category) => void;
  saveEdit: (id: string) => void;
  cancelEdit: () => void;
  toggleActive: (cat: Category) => void;
  deleteCategory: (cat: Category) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const paddingLeft = level * 24 + 16; // 16px base + 24px per level

  // Count total nested children
  const countChildren = (cat: typeof node): number => {
    return cat.children.reduce((sum, child) => sum + 1 + countChildren(child), 0);
  };
  const totalChildren = countChildren(node);

  return (
    <>
      <div
        className={`flex items-center gap-2 py-3 ${level > 0 ? 'bg-neutral-900/30' : ''} ${!node.is_active ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '16px' }}
      >
        {hasChildren ? (
          <button
            onClick={() => toggleExpand(node.id)}
            className="p-1 hover:bg-neutral-800 rounded"
          >
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-neutral-500" />
              : <ChevronRight className="w-4 h-4 text-neutral-500" />
            }
          </button>
        ) : (
          <div className="w-6" />
        )}

        {editingId === node.id ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit(node.id);
              if (e.key === "Escape") cancelEdit();
            }}
            className="flex-1 px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-white text-sm focus:outline-none"
            autoFocus
          />
        ) : (
          <span className={`flex-1 ${level === 0 ? 'font-medium text-white' : 'text-sm text-neutral-300'}`}>
            {node.name}
          </span>
        )}

        {hasChildren && (
          <span className="text-xs text-neutral-500">{totalChildren} Sub</span>
        )}

        <div className="flex items-center gap-1">
          {editingId === node.id ? (
            <>
              <button onClick={() => saveEdit(node.id)} className="p-1.5 hover:bg-neutral-800 rounded text-green-400">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={cancelEdit} className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400">
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => startEdit(node)} className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => toggleActive(node)} className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400">
                {node.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteCategory(node)} className="p-1.5 hover:bg-neutral-800 rounded text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Render children recursively */}
      {isExpanded && hasChildren && node.children.map(child => (
        <CategoryNode
          key={child.id}
          node={child}
          level={level + 1}
          expanded={expanded}
          toggleExpand={toggleExpand}
          editingId={editingId}
          editName={editName}
          setEditName={setEditName}
          startEdit={startEdit}
          saveEdit={saveEdit}
          cancelEdit={cancelEdit}
          toggleActive={toggleActive}
          deleteCategory={deleteCategory}
        />
      ))}
    </>
  );
}
