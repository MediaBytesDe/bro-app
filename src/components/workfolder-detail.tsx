'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { HeaderSection } from './workfolder/header-section';
import { InfoSection } from './workfolder/info-section';
import { DocumentsSection } from './workfolder/documents-section';
import { MessagesSection } from './workfolder/messages-section';
import { createClient } from '@/lib/supabase/client';
import type { Project, Document, Message } from '@/types/database';

interface Props {
  project: Project;
}

export function WorkfolderDetail({ project: initialProject }: Props) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjectData = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();

      // Load documents
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', initialProject.id)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;

      // Load messages
      const { data: msgs, error: msgsError } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', initialProject.id)
        .order('created_at', { ascending: true });

      if (msgsError) throw msgsError;

      // Load full project data with relations
      const { data: fullProject, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', initialProject.id)
        .single();

      if (projectError) throw projectError;

      if (fullProject) {
        setProject(fullProject);
      }
      setDocuments(docs || []);
      setMessages(msgs || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Laden der Projektdaten';
      console.error('Error loading project data:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [initialProject.id]);

  const checkPermissions = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setCanEdit(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setCanEdit(profile?.role && ['admin', 'mitarbeiter'].includes(profile.role));
    } catch (err) {
      console.error('Error checking permissions:', err);
      setCanEdit(false);
    }
  }, []);

  useEffect(() => {
    loadProjectData();
    checkPermissions();
  }, [loadProjectData, checkPermissions]);

  const handleBack = () => {
    router.back();
  };

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit project:', project.id);
  };

  const handleDelete = async () => {
    if (!confirm('Möchten Sie dieses Projekt wirklich löschen?')) {
      return;
    }

    try {
      setError(null);
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (deleteError) throw deleteError;

      router.push('/projects');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Löschen des Projekts';
      console.error('Error deleting project:', err);
      setError(errorMessage);
      alert(errorMessage);
    }
  };

  const handleUpload = () => {
    // TODO: Implement upload functionality
    console.log('Upload document for project:', project.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-neutral-700 rounded"></div>
          <div className="h-64 bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      <HeaderSection
        project={project}
        onBack={handleBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canEdit={canEdit}
      />

      {error && (
        <div className="mx-6 mt-6 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200">
          <p className="font-semibold">Fehler</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Info */}
          <div className="lg:col-span-1">
            <InfoSection project={project} />
          </div>

          {/* Right column - Documents and Messages */}
          <div className="lg:col-span-2 space-y-6">
            <DocumentsSection
              documents={documents}
              onUpload={handleUpload}
              canUpload={canEdit}
            />
            <MessagesSection
              messages={messages}
              canSendMessage={canEdit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
