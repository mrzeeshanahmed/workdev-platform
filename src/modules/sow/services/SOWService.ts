/**
 * Statement of Work (SOW) Service
 *
 * Complete business logic for SOW document generation, management, and signatures
 */

import { supabaseClient } from '../../../config/supabase/client';
import type {
  SOWDocument,
  SOWDocumentWithDetails,
  SOWDocumentWithSignatures,
  SOWTemplate,
  SOWSignature,
  SOWStatistics,
  GenerateSOWRequest,
  GenerateSOWResponse,
  UpdateSOWRequest,
  RequestSignaturesRequest,
  SignDocumentRequest,
  CancelSOWRequest,
  SOWData,
  ActivityType,
} from '../types';
import {
  SOWGenerationError,
  TemplateNotFoundError,
  InvalidSOWDataError,
  SignatureError,
} from '../types';

// Helper to ensure supabase client is initialized
const getSupabase = () => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }
  return supabaseClient;
};

/**
 * SOW Service - Complete SOW document lifecycle management
 */
export class SOWService {
  // =====================================================
  // TEMPLATE MANAGEMENT
  // =====================================================

  /**
   * Get all available SOW templates
   */
  static async getTemplates(category?: string): Promise<SOWTemplate[]> {
    try {
      const supabase = getSupabase();
      let query = supabase
        .from('sow_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_type');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get templates:', error);
      throw error;
    }
  }

  /**
   * Get a specific template by type
   */
  static async getTemplate(templateType: string): Promise<SOWTemplate> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('sow_templates')
        .select('*')
        .eq('template_type', templateType)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      if (!data) throw new TemplateNotFoundError(templateType);
      return data;
    } catch (error) {
      console.error('Failed to get template:', error);
      throw error;
    }
  }

  /**
   * Get default template for a category
   */
  static async getDefaultTemplate(category: string = 'development'): Promise<SOWTemplate> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('sow_templates')
        .select('*')
        .eq('category', category)
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      if (!data) throw new TemplateNotFoundError(`default for ${category}`);
      return data;
    } catch (error) {
      console.error('Failed to get default template:', error);
      throw error;
    }
  }

  // =====================================================
  // SOW DOCUMENT MANAGEMENT
  // =====================================================

  /**
   * Generate a new SOW document
   */
  static async generateSOW(
    userId: string,
    request: GenerateSOWRequest,
  ): Promise<GenerateSOWResponse> {
    try {
      const supabase = getSupabase();

      // 1. Gather project data
      const projectData = await this.gatherProjectData(request.project_id);

      // 2. Get template
      const template = await this.getTemplate(request.template_type);

      // 3. Validate required fields
      this.validateSOWData(template, projectData);

      // 4. Generate document number
      const { data: docNumData } = await supabase.rpc('generate_sow_document_number');
      const documentNumber = docNumData as string;

      // 5. Populate SOW data
      const sowData = this.populateSOWData(template, projectData, request.custom_data);

      // 6. Create SOW document record
      const { data: sowDocument, error } = await supabase
        .from('sow_documents')
        .insert({
          project_id: request.project_id,
          template_id: template.id,
          client_user_id: projectData.client_user_id,
          developer_user_id: projectData.developer_user_id,
          document_number: documentNumber,
          title: `SOW - ${projectData.project_title}`,
          template_type: request.template_type,
          status: 'draft',
          version: 1,
          sow_data: sowData,
          total_budget: projectData.total_budget,
          currency: projectData.currency || 'USD',
        })
        .select()
        .single();

      if (error) throw error;

      // 7. Create milestones
      if (projectData.milestones && projectData.milestones.length > 0) {
        await this.createSOWMilestones(sowDocument.id, projectData.milestones);
      }

      // 8. Create terms from template
      if (template.default_terms) {
        await this.createSOWTerms(sowDocument.id, template.default_terms);
      }

      // 9. Log activity
      await this.logActivity(sowDocument.id, {
        activity_type: 'created',
        description: 'SOW document created',
        user_id: userId,
      });

      // 10. Generate PDF (simulated - would call actual PDF service)
      const documentUrl = await this.generatePDFDocument(sowDocument);

      // Update document with URL
      const { data: updatedDocument } = await supabase
        .from('sow_documents')
        .update({ document_url: documentUrl })
        .eq('id', sowDocument.id)
        .select()
        .single();

      // 11. Prepare signature requirements
      const signaturesRequired = [
        {
          role: 'client' as const,
          name: projectData.client_name || 'Client',
          email: projectData.client_email || '',
          required: true,
        },
        {
          role: 'developer' as const,
          name: projectData.developer_name || 'Developer',
          email: projectData.developer_email || '',
          required: true,
        },
      ];

      // 12. Auto-send for signature if requested
      if (request.auto_send_for_signature) {
        await this.requestSignatures(userId, {
          sow_document_id: sowDocument.id,
          signers: signaturesRequired.map((sig) => ({
            user_id:
              sig.role === 'client' ? projectData.client_user_id : projectData.developer_user_id,
            role: sig.role,
            name: sig.name,
            email: sig.email,
          })),
        });
      }

      return {
        sow_document: updatedDocument || sowDocument,
        document_url: documentUrl,
        signatures_required: signaturesRequired,
        next_steps: [
          'Review the generated SOW document',
          'Request signatures from both parties',
          'SOW becomes binding once both parties sign',
          'Project work can commence after SOW execution',
        ],
      };
    } catch (error) {
      console.error('SOW generation failed:', error);
      throw new SOWGenerationError(
        error instanceof Error ? error.message : 'Failed to generate SOW',
      );
    }
  }

  /**
   * Get SOW documents for a user
   */
  static async getSOWDocuments(
    userId: string,
    filters?: { status?: string; project_id?: string },
  ): Promise<SOWDocument[]> {
    try {
      const supabase = getSupabase();
      let query = supabase
        .from('sow_documents')
        .select('*')
        .or(`client_user_id.eq.${userId},developer_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get SOW documents:', error);
      throw error;
    }
  }

  /**
   * Get SOW document with full details
   */
  static async getSOWDocument(sowId: string, userId: string): Promise<SOWDocumentWithDetails> {
    try {
      const supabase = getSupabase();

      // Get SOW document
      const { data: sowDocument, error: sowError } = await supabase
        .from('sow_documents')
        .select('*')
        .eq('id', sowId)
        .or(`client_user_id.eq.${userId},developer_user_id.eq.${userId}`)
        .single();

      if (sowError) throw sowError;
      if (!sowDocument) throw new Error('SOW document not found or access denied');

      // Get related data in parallel
      const [
        { data: signatures },
        { data: milestones },
        { data: terms },
        { data: versions },
        { data: activityLog },
      ] = await Promise.all([
        supabase.from('sow_signatures').select('*').eq('sow_document_id', sowId),
        supabase
          .from('sow_milestones')
          .select('*')
          .eq('sow_document_id', sowId)
          .order('display_order'),
        supabase.from('sow_terms').select('*').eq('sow_document_id', sowId).order('display_order'),
        supabase
          .from('sow_versions')
          .select('*')
          .eq('sow_document_id', sowId)
          .order('version_number', { ascending: false }),
        supabase
          .from('sow_activity_log')
          .select('*')
          .eq('sow_document_id', sowId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      return {
        ...sowDocument,
        signatures: signatures || [],
        milestones: milestones || [],
        terms: terms || [],
        versions: versions || [],
        activity_log: activityLog || [],
      };
    } catch (error) {
      console.error('Failed to get SOW document:', error);
      throw error;
    }
  }

  /**
   * Update SOW document
   */
  static async updateSOW(
    sowId: string,
    userId: string,
    updates: UpdateSOWRequest,
  ): Promise<SOWDocument> {
    try {
      const supabase = getSupabase();

      // Verify ownership
      const { data: existing } = await supabase
        .from('sow_documents')
        .select('client_user_id, developer_user_id, version')
        .eq('id', sowId)
        .single();

      if (!existing) throw new Error('SOW document not found');
      if (existing.client_user_id !== userId && existing.developer_user_id !== userId) {
        throw new Error('Access denied');
      }

      // Prepare update data
      const updateData: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // Increment version if requested
      if (updates.increment_version) {
        updateData.version = existing.version + 1;
        delete updateData.increment_version;
      }

      // Update document
      const { data, error } = await supabase
        .from('sow_documents')
        .update(updateData)
        .eq('id', sowId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await this.logActivity(sowId, {
        activity_type: 'updated',
        description: 'SOW document updated',
        user_id: userId,
        activity_data: updates,
      });

      return data;
    } catch (error) {
      console.error('Failed to update SOW:', error);
      throw error;
    }
  }

  /**
   * Cancel SOW document
   */
  static async cancelSOW(userId: string, request: CancelSOWRequest): Promise<SOWDocument> {
    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from('sow_documents')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancellation_reason: request.reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.sow_document_id)
        .or(`client_user_id.eq.${userId},developer_user_id.eq.${userId}`)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await this.logActivity(request.sow_document_id, {
        activity_type: 'cancelled',
        description: `SOW cancelled: ${request.reason}`,
        user_id: userId,
      });

      return data;
    } catch (error) {
      console.error('Failed to cancel SOW:', error);
      throw error;
    }
  }

  // =====================================================
  // SIGNATURE MANAGEMENT
  // =====================================================

  /**
   * Request digital signatures
   */
  static async requestSignatures(
    userId: string,
    request: RequestSignaturesRequest,
  ): Promise<SOWSignature[]> {
    try {
      const supabase = getSupabase();

      // Create signature records
      const signatureInserts = request.signers.map((signer) => ({
        sow_document_id: request.sow_document_id,
        signer_user_id: signer.user_id,
        signer_role: signer.role,
        signer_name: signer.name,
        signer_email: signer.email,
        signer_title: signer.title,
        signature_type: 'digital' as const,
        status: 'pending' as const,
      }));

      const { data: signatures, error } = await supabase
        .from('sow_signatures')
        .insert(signatureInserts)
        .select();

      if (error) throw error;

      // Update SOW status
      await supabase
        .from('sow_documents')
        .update({
          status: 'pending_signatures',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.sow_document_id);

      // Log activity
      await this.logActivity(request.sow_document_id, {
        activity_type: 'sent_for_signature',
        description: `Signature requests sent to ${request.signers.length} parties`,
        user_id: userId,
      });

      // TODO: Send signature request emails to signers

      return signatures || [];
    } catch (error) {
      console.error('Failed to request signatures:', error);
      throw new SignatureError('Failed to request signatures');
    }
  }

  /**
   * Sign SOW document
   */
  static async signDocument(userId: string, request: SignDocumentRequest): Promise<SOWSignature> {
    try {
      const supabase = getSupabase();

      // Verify signature belongs to user
      const { data: existing } = await supabase
        .from('sow_signatures')
        .select('signer_user_id, status')
        .eq('id', request.signature_id)
        .single();

      if (!existing) throw new SignatureError('Signature record not found');
      if (existing.signer_user_id !== userId) {
        throw new SignatureError('Access denied');
      }
      if (existing.status === 'signed') {
        throw new SignatureError('Document already signed');
      }

      // Update signature
      const { data, error } = await supabase
        .from('sow_signatures')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signature_data: request.signature_data,
          signature_method: request.signature_method,
          ip_address: request.ip_address,
          user_agent: request.user_agent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.signature_id)
        .select()
        .single();

      if (error) throw error;

      // Log activity (trigger will handle SOW status update)
      const { data: signatureWithDoc } = await supabase
        .from('sow_signatures')
        .select('sow_document_id')
        .eq('id', request.signature_id)
        .single();

      if (signatureWithDoc) {
        await this.logActivity(signatureWithDoc.sow_document_id, {
          activity_type: 'signature_completed',
          description: 'Document signed',
          user_id: userId,
        });
      }

      return data;
    } catch (error) {
      console.error('Failed to sign document:', error);
      throw new SignatureError(error instanceof Error ? error.message : 'Failed to sign document');
    }
  }

  /**
   * Get signatures with progress for a SOW
   */
  static async getSOWSignatures(sowId: string): Promise<SOWDocumentWithSignatures> {
    try {
      const supabase = getSupabase();

      const { data: sowDocument, error: docError } = await supabase
        .from('sow_documents')
        .select('*')
        .eq('id', sowId)
        .single();

      if (docError) throw docError;

      const { data: signatures, error: sigError } = await supabase
        .from('sow_signatures')
        .select('*')
        .eq('sow_document_id', sowId);

      if (sigError) throw sigError;

      const signatureList = signatures || [];
      const completedSignatures = signatureList.filter((s) => s.status === 'signed').length;
      const totalSignatures = signatureList.length;

      return {
        ...sowDocument,
        signatures: signatureList,
        pending_signatures: totalSignatures - completedSignatures,
        completed_signatures: completedSignatures,
        signature_progress: totalSignatures > 0 ? (completedSignatures / totalSignatures) * 100 : 0,
      };
    } catch (error) {
      console.error('Failed to get SOW signatures:', error);
      throw error;
    }
  }

  // =====================================================
  // STATISTICS & ANALYTICS
  // =====================================================

  /**
   * Get SOW statistics for a user
   */
  static async getStatistics(userId: string): Promise<SOWStatistics> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('get_sow_statistics', {
        user_id_param: userId,
      });

      if (error) throw error;

      return (
        data[0] || {
          total_sows: 0,
          draft_sows: 0,
          pending_signatures: 0,
          signed_sows: 0,
          cancelled_sows: 0,
          total_contract_value: 0,
          avg_time_to_signature_days: 0,
        }
      );
    } catch (error) {
      console.error('Failed to get statistics:', error);
      throw error;
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  /**
   * Gather project data for SOW generation
   */
  private static async gatherProjectData(projectId: string): Promise<any> {
    const supabase = getSupabase();

    const { data: project, error } = await supabase
      .from('projects')
      .select(
        `
        *,
        client_profiles!inner(company_name, company_website, user_id),
        developer_profiles!inner(display_name, headline, hourly_rate, user_id)
      `,
      )
      .eq('id', projectId)
      .single();

    if (error) throw error;
    if (!project) throw new Error('Project not found');

    // Get milestones
    const { data: milestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order');

    return {
      project_title: project.title,
      project_description: project.description,
      client_user_id: project.client_profiles.user_id,
      developer_user_id: project.developer_profiles.user_id,
      client_company: project.client_profiles.company_name,
      client_name: project.client_profiles.company_name,
      client_email: '', // Would need to fetch from users table
      developer_name: project.developer_profiles.display_name,
      developer_email: '', // Would need to fetch from users table
      total_budget: project.budget,
      currency: project.currency || 'USD',
      milestones: milestones || [],
      estimated_timeline: project.estimated_duration || 'TBD',
      required_skills: project.skills || [],
      project_type: project.type,
    };
  }

  /**
   * Populate SOW data from template and project data
   */
  private static populateSOWData(
    template: SOWTemplate,
    projectData: any,
    customData?: Partial<SOWData>,
  ): SOWData {
    const baseData: SOWData = {
      project_title: projectData.project_title,
      project_description: projectData.project_description,
      project_type: projectData.project_type,
      client_company: projectData.client_company,
      developer_name: projectData.developer_name,
      scope_of_work: [],
      objectives: [],
      deliverables: [],
      milestones: projectData.milestones.map((m: any, index: number) => ({
        id: m.id,
        title: m.title,
        description: m.description || '',
        deliverables: m.deliverables || [],
        acceptance_criteria: m.acceptance_criteria || [],
        budget: m.amount || 0,
        payment_percentage: ((m.amount / projectData.total_budget) * 100).toFixed(2),
        estimated_completion_date: m.due_date,
      })),
      timeline: {
        estimated_duration: projectData.estimated_timeline,
        milestone_schedule: [],
      },
      payment_terms: {
        total_budget: projectData.total_budget,
        currency: projectData.currency,
        payment_schedule: 'milestone',
        platform_fee_percentage: 10,
        payment_method: 'WorkDev Platform',
        payment_due_days: 7,
      },
      total_budget: projectData.total_budget,
      currency: projectData.currency,
      client_responsibilities: [
        'Provide timely feedback on deliverables',
        'Supply necessary project resources and information',
        'Review and approve milestones within specified timeframes',
      ],
      developer_responsibilities: [
        'Deliver work according to specified requirements',
        'Maintain regular communication on project progress',
        'Ensure quality standards are met for all deliverables',
      ],
      technologies: projectData.required_skills,
      ...customData,
    };

    // Apply default terms from template
    if (template.default_terms) {
      baseData.intellectual_property_terms = template.default_terms.intellectual_property;
      baseData.confidentiality_terms = template.default_terms.confidentiality;
      baseData.termination_clauses = template.default_terms.termination;
      baseData.liability_limitations = template.default_terms.liability;
      baseData.dispute_resolution = template.default_terms.dispute_resolution;
    }

    return baseData;
  }

  /**
   * Validate SOW data against template requirements
   */
  private static validateSOWData(template: SOWTemplate, projectData: any): void {
    const missingFields: string[] = [];

    for (const field of template.required_fields) {
      if (!projectData[field] && projectData[field] !== 0) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      throw new InvalidSOWDataError(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Create SOW milestones from project milestones
   */
  private static async createSOWMilestones(
    sowDocumentId: string,
    milestones: any[],
  ): Promise<void> {
    const supabase = getSupabase();

    const milestoneInserts = milestones.map((m, index) => ({
      sow_document_id: sowDocumentId,
      milestone_id: m.id,
      milestone_number: index + 1,
      title: m.title,
      description: m.description || '',
      deliverables: m.deliverables || [],
      acceptance_criteria: m.acceptance_criteria || [],
      budget: m.amount || 0,
      display_order: index + 1,
    }));

    await supabase.from('sow_milestones').insert(milestoneInserts);
  }

  /**
   * Create SOW terms from template defaults
   */
  private static async createSOWTerms(
    sowDocumentId: string,
    defaultTerms: Record<string, string>,
  ): Promise<void> {
    const supabase = getSupabase();

    const termInserts = Object.entries(defaultTerms).map(([type, content], index) => ({
      sow_document_id: sowDocumentId,
      term_type: type,
      title: this.formatTermTitle(type),
      content: content,
      display_order: index + 1,
      is_mandatory: true,
    }));

    await supabase.from('sow_terms').insert(termInserts);
  }

  /**
   * Format term type to readable title
   */
  private static formatTermTitle(termType: string): string {
    return termType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate PDF document (simulated - would integrate with actual PDF service)
   */
  private static async generatePDFDocument(sowDocument: SOWDocument): Promise<string> {
    // In production, this would call a PDF generation service
    // For now, return a placeholder URL
    const documentUrl = `https://storage.example.com/sow/${sowDocument.id}.pdf`;
    return documentUrl;
  }

  /**
   * Log activity for SOW document
   */
  private static async logActivity(
    sowDocumentId: string,
    activity: {
      activity_type: ActivityType;
      description: string;
      user_id?: string;
      activity_data?: any;
    },
  ): Promise<void> {
    try {
      const supabase = getSupabase();
      await supabase.from('sow_activity_log').insert({
        sow_document_id: sowDocumentId,
        ...activity,
      });
    } catch (error) {
      // Log activity errors should not break the main flow
      console.error('Failed to log activity:', error);
    }
  }
}

export default SOWService;
