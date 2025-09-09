import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { questionApi, surveyApi } from '../services/api';
import { Question, Survey, Section } from '../types';
import { Plus, Search, Edit, Trash2, Upload, Download, FileText, Eye, Filter } from 'lucide-react';
import { formatDateTime } from '../utils';

export function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSurvey, setSelectedSurvey] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    text: '',
    type: 'single_choice' as 'single_choice' | 'multiple_choice',
    complexity: 'medium' as 'easy' | 'medium' | 'hard',
    points: 1,
    explanation: '',
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ]
  });

  useEffect(() => {
    fetchQuestions();
    fetchSurveys();
  }, [selectedSurvey, selectedSection]);

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      if (selectedSection) {
        const response = await questionApi.getQuestions(selectedSection);
        setQuestions(response.data || []);
      } else {
        setQuestions([]);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSurveys = async () => {
    try {
      const response = await surveyApi.getSurveys();
      setSurveys(response.data || []);
    } catch (error) {
      console.error('Failed to fetch surveys:', error);
      setSurveys([]);
    }
  };

  const fetchSections = async (surveyId: string) => {
    try {
      const response = await surveyApi.getSurveySections(surveyId);
      setSections(response.data || []);
    } catch (error) {
      console.error('Failed to fetch sections:', error);
      setSections([]);
    }
  };

  const handleSurveyChange = (surveyId: string) => {
    setSelectedSurvey(surveyId);
    setSelectedSection('');
    if (surveyId) {
      fetchSections(surveyId);
    } else {
      setSections([]);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedFile || !selectedSection) {
      alert('Please select a file and section');
      return;
    }

    try {
      setIsUploading(true);
      const response = await questionApi.bulkUploadQuestions(selectedSection, selectedFile);
      setUploadResult(response);
      
      if (response.success) {
        fetchQuestions(); // Refresh questions list
        setSelectedFile(null);
        setIsUploadModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to upload questions:', error);
      setUploadResult({
        success: false,
        message: 'Upload failed. Please try again.',
        errors: ['Network error or server unavailable']
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateQuestion = async () => {
    if (!selectedSection) {
      alert('Please select a section first');
      return;
    }

    try {
      const response = await questionApi.createQuestion(selectedSection, formData);
      if (response.success) {
        fetchQuestions();
        setIsCreateModalOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Failed to create question:', error);
    }
  };

  const handleEditQuestion = async () => {
    if (!selectedQuestion) return;

    try {
      const response = await questionApi.updateQuestion(selectedQuestion.id, formData);
      if (response.success) {
        fetchQuestions();
        setIsEditModalOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Failed to update question:', error);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        const response = await questionApi.deleteQuestion(id);
        if (response.success) {
          fetchQuestions();
        }
      } catch (error) {
        console.error('Failed to delete question:', error);
      }
    }
  };

  const openEditModal = (question: Question) => {
    setSelectedQuestion(question);
    setFormData({
      text: question.text,
      type: question.type,
      complexity: question.complexity,
      points: question.points,
      explanation: question.explanation || '',
      options: question.options.length > 0 ? question.options : [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ]
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      text: '',
      type: 'single_choice',
      complexity: 'medium',
      points: 1,
      explanation: '',
      options: [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ]
    });
    setSelectedQuestion(null);
  };

  const updateOption = (index: number, field: 'text' | 'isCorrect', value: string | boolean) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    
    // For single choice, ensure only one option is correct
    if (field === 'isCorrect' && value === true && formData.type === 'single_choice') {
      newOptions.forEach((option, i) => {
        if (i !== index) {
          option.isCorrect = false;
        }
      });
    }
    
    setFormData({ ...formData, options: newOptions });
  };

  const filteredQuestions = questions.filter(question =>
    question.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
            <p className="text-gray-600 mt-2">Manage questions for your surveys</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              variant="secondary"
              className="flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Upload</span>
            </Button>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2"
              disabled={!selectedSection}
            >
              <Plus className="w-4 h-4" />
              <span>Add Question</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Survey</label>
              <select
                value={selectedSurvey}
                onChange={(e) => handleSurveyChange(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Survey</option>
                {surveys.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!selectedSurvey}
              >
                <option value="">Select Section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search questions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Questions List */}
        <Card>
          {!selectedSection ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Section</h3>
              <p className="text-gray-500">Choose a survey and section to view questions</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading questions...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Questions Found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? 'No questions match your search criteria.' : 'This section has no questions yet.'}
              </p>
              {!searchTerm && (
                <div className="space-y-2">
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First Question</span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="flex items-center space-x-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Bulk Upload Questions</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          Q{index + 1}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          question.type === 'single_choice' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {question.type === 'single_choice' ? 'Single Choice' : 'Multiple Choice'}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          question.complexity === 'easy' ? 'bg-green-100 text-green-800' :
                          question.complexity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {question.complexity.charAt(0).toUpperCase() + question.complexity.slice(1)}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                          {question.points} point{question.points !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">{question.text}</h3>
                      
                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className={`flex items-center space-x-3 p-3 rounded-lg ${
                            option.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                          }`}>
                            <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="flex-1">{option.text}</span>
                            {option.isCorrect && (
                              <span className="text-green-600 text-sm font-medium">✓ Correct</span>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {question.explanation && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>Explanation:</strong> {question.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => openEditModal(question)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Create Question Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            resetForm();
          }}
          title="Create New Question"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Enter your question"
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="single_choice">Single Choice</option>
                  <option value="multiple_choice">Multiple Choice</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complexity</label>
                <select
                  value={formData.complexity}
                  onChange={(e) => setFormData({ ...formData, complexity: e.target.value as any })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                <input
                  type="number"
                  min="1"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Answer Options</label>
              <div className="space-y-3">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(index, 'text', e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <label className="flex items-center space-x-2">
                      <input
                        type={formData.type === 'single_choice' ? 'radio' : 'checkbox'}
                        name="correct-answer"
                        checked={option.isCorrect}
                        onChange={(e) => updateOption(index, 'isCorrect', e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">Correct</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (Optional)</label>
              <textarea
                value={formData.explanation}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                placeholder="Provide an explanation for the correct answer"
                rows={2}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateQuestion}>
                Create Question
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Question Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            resetForm();
          }}
          title="Edit Question"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Enter your question"
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="single_choice">Single Choice</option>
                  <option value="multiple_choice">Multiple Choice</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complexity</label>
                <select
                  value={formData.complexity}
                  onChange={(e) => setFormData({ ...formData, complexity: e.target.value as any })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                <input
                  type="number"
                  min="1"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Answer Options</label>
              <div className="space-y-3">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(index, 'text', e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <label className="flex items-center space-x-2">
                      <input
                        type={formData.type === 'single_choice' ? 'radio' : 'checkbox'}
                        name="correct-answer"
                        checked={option.isCorrect}
                        onChange={(e) => updateOption(index, 'isCorrect', e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">Correct</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (Optional)</label>
              <textarea
                value={formData.explanation}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                placeholder="Provide an explanation for the correct answer"
                rows={2}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditModalOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEditQuestion}>
                Update Question
              </Button>
            </div>
          </div>
        </Modal>

        {/* Bulk Upload Modal */}
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            setSelectedFile(null);
            setUploadResult(null);
          }}
          title="Bulk Upload Questions"
          size="lg"
        >
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Upload Instructions</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  Upload a CSV file with the following columns:
                </p>
                <div className="text-xs text-blue-700 font-mono bg-blue-100 p-2 rounded">
                  Question Text, Type, Complexity, Option A, Option B, Option C, Option D, Correct Answer, Points, Explanation
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  • Type: "single_choice" or "multiple_choice"<br/>
                  • Complexity: "easy", "medium", or "hard"<br/>
                  • Correct Answer: "A", "B", "C", or "D"<br/>
                  • Points: Number (default: 1)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 mt-1">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {uploadResult && (
              <div className={`p-4 rounded-lg border ${
                uploadResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <h4 className={`font-medium mb-2 ${
                  uploadResult.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  Upload {uploadResult.success ? 'Successful' : 'Failed'}
                </h4>
                <div className={`text-sm ${
                  uploadResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {uploadResult.message}
                  {uploadResult.questionsAdded && (
                    <p>Questions added: {uploadResult.questionsAdded}</p>
                  )}
                  {uploadResult.questionsSkipped && (
                    <p>Questions skipped: {uploadResult.questionsSkipped}</p>
                  )}
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Errors:</p>
                      <ul className="list-disc list-inside">
                        {uploadResult.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFile(null);
                  setUploadResult(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkUpload}
                disabled={!selectedFile || !selectedSection || isUploading}
                loading={isUploading}
                className="flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Questions</span>
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}