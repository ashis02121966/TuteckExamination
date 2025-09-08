import { supabase } from '../lib/supabase';

export interface ActivityLogEntry {
  user_id?: string;
  activity_type: string;
  description: string;
  metadata?: any;
  ip_address?: string;
  user_agent?: string;
}

export class ActivityLogger {
  static async log(entry: ActivityLogEntry): Promise<void> {
    try {
      if (!supabase) {
        if (import.meta.env.DEV) {
          console.log('ActivityLogger: Supabase not configured, skipping log');
        }
        return;
      }

      // Get current user if not provided
      let userId = entry.user_id;
      if (!userId) {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          userId = user.id;
        }
      }

      // Get client IP and user agent
      const userAgent = navigator.userAgent;
      
      const logData = {
        user_id: userId,
        activity_type: entry.activity_type,
        description: entry.description,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip_address: entry.ip_address || null, // Will be null for client-side logging
        user_agent: userAgent
      };

      const { error } = await supabase
        .from('activity_logs')
        .insert(logData);

      if (error) {
        if (import.meta.env.DEV) {
          console.error('ActivityLogger: Failed to log activity:', error);
        }
      } else {
        if (import.meta.env.DEV) {
          console.log('ActivityLogger: Activity logged successfully:', entry.activity_type);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('ActivityLogger: Error logging activity:', error);
      }
    }
  }

  // Convenience methods for common activities
  static async logLogin(userId: string, email: string) {
    await this.log({
      user_id: userId,
      activity_type: 'user_login',
      description: `User logged in: ${email}`,
      metadata: { email, login_time: new Date().toISOString() }
    });
  }

  static async logLogout(userId: string, email: string) {
    await this.log({
      user_id: userId,
      activity_type: 'user_logout',
      description: `User logged out: ${email}`,
      metadata: { email, logout_time: new Date().toISOString() }
    });
  }

  static async logTestStart(userId: string, surveyId: string, surveyTitle: string) {
    await this.log({
      user_id: userId,
      activity_type: 'test_started',
      description: `Started test: ${surveyTitle}`,
      metadata: { survey_id: surveyId, survey_title: surveyTitle, start_time: new Date().toISOString() }
    });
  }

  static async logTestComplete(userId: string, surveyId: string, surveyTitle: string, score: number, isPassed: boolean) {
    await this.log({
      user_id: userId,
      activity_type: 'test_completed',
      description: `Completed test: ${surveyTitle} - Score: ${score}% (${isPassed ? 'Passed' : 'Failed'})`,
      metadata: { 
        survey_id: surveyId, 
        survey_title: surveyTitle, 
        score, 
        is_passed: isPassed,
        completion_time: new Date().toISOString() 
      }
    });
  }

  static async logUserCreated(adminUserId: string, newUserId: string, newUserEmail: string, roleName: string) {
    await this.log({
      user_id: adminUserId,
      activity_type: 'user_created',
      description: `Created new user: ${newUserEmail} with role ${roleName}`,
      metadata: { 
        new_user_id: newUserId, 
        new_user_email: newUserEmail, 
        role_name: roleName,
        creation_time: new Date().toISOString() 
      }
    });
  }

  static async logSurveyCreated(userId: string, surveyId: string, surveyTitle: string) {
    await this.log({
      user_id: userId,
      activity_type: 'survey_created',
      description: `Created new survey: ${surveyTitle}`,
      metadata: { 
        survey_id: surveyId, 
        survey_title: surveyTitle,
        creation_time: new Date().toISOString() 
      }
    });
  }

  static async logSurveyUpdated(userId: string, surveyId: string, surveyTitle: string) {
    await this.log({
      user_id: userId,
      activity_type: 'survey_updated',
      description: `Updated survey: ${surveyTitle}`,
      metadata: { 
        survey_id: surveyId, 
        survey_title: surveyTitle,
        update_time: new Date().toISOString() 
      }
    });
  }

  static async logSurveyDeleted(userId: string, surveyId: string, surveyTitle: string) {
    await this.log({
      user_id: userId,
      activity_type: 'survey_deleted',
      description: `Deleted survey: ${surveyTitle}`,
      metadata: { 
        survey_id: surveyId, 
        survey_title: surveyTitle,
        deletion_time: new Date().toISOString() 
      }
    });
  }

  static async logQuestionUploaded(userId: string, surveyId: string, questionsCount: number) {
    await this.log({
      user_id: userId,
      activity_type: 'questions_uploaded',
      description: `Uploaded ${questionsCount} questions to survey`,
      metadata: { 
        survey_id: surveyId, 
        questions_count: questionsCount,
        upload_time: new Date().toISOString() 
      }
    });
  }

  static async logCertificateIssued(userId: string, certificateId: string, certificateNumber: string, surveyTitle: string) {
    await this.log({
      user_id: userId,
      activity_type: 'certificate_issued',
      description: `Certificate issued: ${certificateNumber} for ${surveyTitle}`,
      metadata: { 
        certificate_id: certificateId, 
        certificate_number: certificateNumber,
        survey_title: surveyTitle,
        issue_time: new Date().toISOString() 
      }
    });
  }

  static async logSettingUpdated(userId: string, settingKey: string, oldValue: string, newValue: string) {
    await this.log({
      user_id: userId,
      activity_type: 'setting_updated',
      description: `Updated setting: ${settingKey}`,
      metadata: { 
        setting_key: settingKey, 
        old_value: oldValue, 
        new_value: newValue,
        update_time: new Date().toISOString() 
      }
    });
  }
}