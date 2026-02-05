'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeaderSection } from './workfolder/header-section';
import { InfoSection } from './workfolder/info-section';
import { DocumentsSection } from './workfolder/documents-section';
import { MessagesSection } from './workfolder/messages-section';
import { createClient } from '@/lib/supabase/client';
import type { Project } from '@/types/database';

interface Props {
  project: Project;
}

export function WorkfolderDetail({ project: initialProject }: Props) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [documents, setDocuments] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    loadProjectData();
    checkPermissions();
  }, [initialProject.id]);

  const loadProjectData = async () => {
    try {
      const supabase = createClient();

      // Load documents
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('project_id', initialProject.id)
        .order('created_at', { ascending: false });

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', initialProject.id)
        .order('created_at', { ascending: true });

      // Load full project data with relations
      const { data: fullProject } = await supabase
        .from('projects')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', initialProject.id)
        .single();

      if (fullProject) {
        setProject(fullProject);
      }
      setDocuments(docs || []);
      setMessages(msgs || []);
    } catch (error) {
      console.error('Error loading project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPermissions = async () => {
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
    } catch (error) {
      console.error('Error checking permissions:', error);
      setCanEdit(false);
    }
  };

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
      const supabase = createClient();
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;

      router.push('/projects');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Fehler beim Löschen des Projekts');
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
