"use client";

import { useEffect, useState, useCallback } from "react";
import { getPortalAPI, type PortalProject, type PortalOffer, type PortalDocument, type PortalMessage, type PortalAppointment } from "@/lib/dashboard-api";

export function usePortalProjects() {
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await getPortalAPI().getProjects());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { projects, loading, reload };
}

export function usePortalOffers() {
  const [offers, setOffers] = useState<PortalOffer[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setOffers(await getPortalAPI().getOffers());
    } finally {
      setLoading(false);
    }
  }, []);

  const respond = useCallback(async (id: number, status: 'accepted' | 'rejected') => {
    await getPortalAPI().respondToOffer(id, status);
    await reload();
  }, [reload]);

  useEffect(() => { reload(); }, [reload]);
  return { offers, loading, reload, respond };
}

export function usePortalDocuments() {
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(await getPortalAPI().getDocuments());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { documents, loading, reload };
}

export function usePortalMessages() {
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setMessages(await getPortalAPI().getMessages());
    } finally {
      setLoading(false);
    }
  }, []);

  const send = useCallback(async (content: string) => {
    await getPortalAPI().sendMessage(content);
    await reload();
  }, [reload]);

  useEffect(() => { reload(); }, [reload]);
  return { messages, loading, reload, send };
}

export function usePortalAppointments() {
  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setAppointments(await getPortalAPI().getAppointments());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { appointments, loading, reload };
}
