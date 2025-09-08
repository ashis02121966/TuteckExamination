import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { questionApi, surveyApi } from '../services/api';
import { Question, Survey, Section } from '../types';
import { Plus, Search, Edit, Trash2, Upload, Download, Filter, Eye, Book, FileText, Target, Clock } from 'lucide-react';
import { formatDateTime } from '../utils';

export function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isEditSectionModalOpen, setIsEditSectionModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [selectedSectionForEdit, setSelectedSectionForEdit] = useState<Section | null>(null);
  const [sectionFormData, setSectionFormData] = useState({
    title: '',
    description: '',
    questionsCount: 10,
    sectionOrder: 1
  });
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
    fetchSurveys();
  }, []);

  useEffect(() => {
    if (selectedSurvey) {
      fetchSections();
    } else {
      setSections([]);
      setSelectedSection('');
      setQuestions([]);
    }
  }, [selectedSurvey]);

  useEffect(() => {
    if (selectedSection) {
      fetchQuestions();
    } else {
      setQuestions([]);
    }
  }, [selectedSection]);

  const fetchSurveys = async () => {
    try {
      setIsLoading(true);
      const response = await surveyApi.getSurveys();
      setSurveys(response.data || []);
    } catch (error) {
      console.error('Failed to fetch surveys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSections = async () => {
    try {
      if (!selectedSurvey) return;
      
      const response = await surveyApi.getSurveySections(selectedSurvey);
      if (response.success && response.data) {
        setSections(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch sections:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      if (!selectedSection) return;
      
      setIsLoading(true);
      const response = await questionApi.getQuestions(selectedSection);
      if (response.success && response.data) {
        setQuestions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateQuestion = async () => {
    if (!selectedSection) {
      alert('Please select a section first');
      return;
    }

    if (!formData.text.trim()) {
      alert('Question text is required');
      return;
    }

    const validOptions = formData.options.filter(opt => opt.text.trim());
    if (validOptions.length < 2) {
      alert('At least 2 options are required');
      return;
    }

    const correctOptions = validOptions.filter(opt => opt.isCorrect);
    if (correctOptions.length === 0) {
      alert('At least one correct option is required');
      return;
    }

    try {
      const response = await questionApi.createQuestion({
        sectionId: selectedSection,
        text: formData.text,
        type: formData.type,
        complexity: formData.complexity,
        points: formData.points,
        explanation: formData.explanation,
        options: validOptions
      });

      if (response.success && response.data) {
        setQuestions([...questions, response.data]);
        setIsCreateModalOpen(false);
        resetForm();
        alert('Question created successfully!');
      } else {
        alert(`Failed to create question: ${response.message}`);
      }
    } catch (error) {
      console.error('Failed to create question:', error);
      alert('Failed to create question. Please try again.');
    }
  };

  const handleEditQuestion = async () => {
    if (!selectedQuestion) return;

    if (!formData.text.trim()) {
      alert('Question text is required');
      return;
    }

    const validOptions = formData.options.filter(opt => opt.text.trim());
    if (validOptions.length < 2) {
      alert('At least 2 options are required');
      return;
    }

    const correctOptions = validOptions.filter(opt => opt.isCorrect);
    if (correctOptions.length === 0) {
      alert('At least one correct option is required');
      return;
    }

    try {
      const response = await questionApi.updateQuestion(selectedQuestion.id, {
        text: formData.text,
        type: formData.type,
        complexity: formData.complexity,
        points: formData.points,
        explanation: formData.explanation,
        options: validOptions
      });

      if (response.success && response.data) {
        setQuestions(questions.map(q => q.id === selectedQuestion.id ? response.data! : q));
        setIsEditModalOpen(false);
        resetForm();
        alert('Question updated successfully!');
      } else {
        alert(`Failed to update question: ${response.message}`);
      }
    } catch (error) {
      console.error('Failed to update question:', error);
      alert('Failed to update question. Please try again.');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (window.confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      try {
        const response = await questionApi.deleteQuestion(questionId);
        if (response.success) {
          setQuestions(questions.filter(q => q.id !== questionId));
          alert('Question deleted successfully!');
        } else {
          alert(`Failed to delete question: ${response.message}`);
        }
      } catch (error) {
        console.error('Failed to delete question:', error);
        alert('Failed to delete question. Please try again.');
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

  const handleOptionChange = (index: number, field: 'text' | 'isCorrect', value: string | boolean) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    
    // For single choice, ensure only one option is correct
    if (field === 'isCorrect' && value === true && formData.type === 'single_choice') {
      newOptions.forEach((opt, i) => {
        if (i !== index) {
          opt.isCorrect = false;
        }
      });
    }
    
    setFormData({ ...formData, options: newOptions });
  };

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { text: '', isCorrect: false }]
    });
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      setFormData({ ...formData, options: newOptions });
    }
  };

  const resetSectionForm = () => {
    setSectionFormData({
      title: '',
      description: '',
      questionsCount: 10,
      sectionOrder: 1
    });
    setSelectedSectionForEdit(null);
  };

  const handleCreateSection = async () => {
    if (!selectedSurvey) {
      alert('Please select a survey first');
      return;
    }

    if (!sectionFormData.title.trim()) {
      alert('Section title is required');
      return;
    }

    try {
      const response = await surveyApi.createSection({
        surveyId: selectedSurvey,
        title: sectionFormData.title,
        description: sectionFormData.description,
        questionsCount: sectionFormData.questionsCount,
        sectionOrder: sectionFormData.sectionOrder
      });

      if (response.success && response.data) {
        setSections([...sections, response.data]);
        setIsSectionModalOpen(false);
        resetSectionForm();
        alert('Section created successfully!');
      } else {
        alert(`Failed to create section: ${response.message}`);
      }
    } catch (error) {
      console.error('Failed to create section:', error);
      alert('Failed to create section. Please try again.');
    }
  };

  const handleEditSection = async () => {
    if (!selectedSectionForEdit) return;

    if (!sectionFormData.title.trim()) {
      alert('Section title is required');
      return;
    }

    try {
      const response = await surveyApi.updateSection(selectedSectionForEdit.id, {
        title: sectionFormData.title,
        description: sectionFormData.description,
        questionsCount: sectionFormData.questionsCount,
        sectionOrder: sectionFormData.sectionOrder
      });

      if (response.success && response.data) {
        setSections(sections.map(s => s.id === selectedSectionForEdit.id ? response.data! : s));
        setIsEditSectionModalOpen(false);
        resetSectionForm();
        alert('Section updated successfully!');
      } else {
        alert(`Failed to update section: ${response.message}`);
      }
    } catch (error) {
      console.error('Failed to update section:', error);
      alert('Failed to update section. Please try again.');
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (window.confirm('Are you sure you want to delete this section? This will also delete all questions in this section. This action cannot be undone.')) {
      try {
        const response = await surveyApi.deleteSection(sectionId);
        if (response.success) {
          setSections(sections.filter(s => s.id !== sectionId));
          if (selectedSection === sectionId) {
            setSelectedSection('');
            setQuestions([]);
          }
          alert('Section deleted successfully!');
        } else {
          alert(`Failed to delete section: ${response.message}`);
        }
      } catch (error) {
        console.error('Failed to delete section:', error);
        alert('Failed to delete section. Please try again.');
      }
    }
  };

  const openEditSectionModal = (section: Section) => {
    setSelectedSectionForEdit(section);
    setSectionFormData({
      title: section.title,
      description: section.description || '',
      questionsCount: section.questions_count,
      sectionOrder: section.section_order
    });
    setIsEditSectionModalOpen(true);
  };

  const handleDownloadTemplate = () => {
    if (!selectedSection || !selectedSectionData) {
      alert('Please select a section first');
      return;
    }

    // Create CSV content with existing questions
    const csvHeaders = ['Question', 'Type', 'Complexity', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'CorrectAnswer', 'Points', 'Explanation'];
    
    let csvContent = csvHeaders.join(',') + '\n';
    
    // Add existing questions to the template
    questions.forEach((question) => {
      const options = question.options || [];
      const correctAnswers = options
        .map((opt, index) => opt.isCorrect ? String.fromCharCode(65 + index) : '')
        .filter(answer => answer)
        .join('');
      
      const row = [
        `"${question.text.replace(/"/g, '""')}"`, // Escape quotes in question text
        question.type,
        question.complexity,
        `"${(options[0]?.text || '').replace(/"/g, '""')}"`,
        `"${(options[1]?.text || '').replace(/"/g, '""')}"`,
        `"${(options[2]?.text || '').replace(/"/g, '""')}"`,
        `"${(options[3]?.text || '').replace(/"/g, '""')}"`,
        correctAnswers,
        question.points,
        `"${(question.explanation || '').replace(/"/g, '""')}"`
      ];
      
      csvContent += row.join(',') + '\n';
    });
    
    // If no existing questions, add sample rows
    if (questions.length === 0) {
      const sampleRows = [
        [
          '"What is the primary function of an operating system?"',
          'single_choice',
          'easy',
          '"To manage hardware and software resources"',
          '"To create documents"',
          '"To browse the internet"',
          '"To play games"',
          'A',
          '1',
          '"An operating system manages all hardware and software resources of a computer."'
        ],
        [
          '"Which of the following are input devices? (Select all that apply)"',
          'multiple_choice',
          'medium',
          '"Keyboard"',
          '"Mouse"',
          '"Monitor"',
          '"Microphone"',
          'ABD',
          '2',
          '"Input devices allow users to provide data to the computer. Monitor is an output device."'
        ]
      ];
      
      sampleRows.forEach(row => {
        csvContent += row.join(',') + '\n';
      });
    }
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `questions_template_${selectedSectionData.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredQuestions = questions.filter(question =>
    question.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedSurveyData = surveys.find(s => s.id === selectedSurvey);
  const selectedSectionData = sections.find(s => s.id === selectedSection);

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
              variant="secondary"
              onClick={() => setIsSectionModalOpen(true)}
              className="flex items-center space-x-2"
              disabled={!selectedSurvey}
            >
              <Plus className="w-4 h-4" />
              <span>Add Section</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center space-x-2"
              disabled={!selectedSection}
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

        {/* Survey and Section Selection */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Survey
              </label>
              <select
                value={selectedSurvey}
                onChange={(e) => setSelectedSurvey(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a survey...</option>
                {surveys.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Section
              </label>
              <div className="flex items-center space-x-2">
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  disabled={!selectedSurvey}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Choose a section...</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title} ({section.questions_count} questions)
                    </option>
                  ))}
                </select>
                {selectedSection && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const section = sections.find(s => s.id === selectedSection);
                      if (section) openEditSectionModal(section);
                    }}
                    className="flex items-center space-x-1"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          {selectedSurveyData && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">{selectedSurveyData.title}</h3>
              <p className="text-sm text-blue-800 mb-2">{selectedSurveyData.description}</p>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-1">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span>Pass: {selectedSurveyData.passingScore}%</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Duration: {selectedSurveyData.duration}m</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Questions: {selectedSurveyData.totalQuestions}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Book className="w-4 h-4 text-blue-600" />
                  <span>Sections: {sections.length}</span>
                </div>
              </div>
            </div>
          )}
          
          {selectedSectionData && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-1">{selectedSectionData.title}</h4>
              <p className="text-sm text-green-800">{selectedSectionData.description}</p>
              <p className="text-xs text-green-700 mt-1">
                Target Questions: {selectedSectionData.questions_count} | Current Questions: {questions.length}
              </p>
            </div>
          )}
        </Card>

        {/* Questions List */}
        <Card>
          {!selectedSection ? (
            <div className="text-center py-12">
              <Book className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select Survey and Section</h3>
              <p className="text-gray-500">Choose a survey and section to view and manage questions</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder="Search questions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {questions.length} question{questions.length !== 1 ? 's' : ''} in this section
                  </span>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading questions...</p>
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm ? 'No Questions Found' : 'No Questions in This Section'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm 
                      ? 'No questions match your search criteria.' 
                      : 'Get started by adding your first question to this section.'
                    }
                  </p>
                  {!searchTerm && (
                    <Button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First Question</span>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredQuestions.map((question, index) => (
                    <div key={question.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                              Question {index + 1}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              question.type === 'single_choice' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-purple-100 text-purple-800'
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
                            <span className="text-xs text-gray-500">
                              {question.points} point{question.points !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">{question.text}</h3>
                          
                          <div className="space-y-2">
                            {question.options.map((option, optIndex) => (
                              <div key={optIndex} className={`flex items-center space-x-2 p-2 rounded ${
                                option.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                              }`}>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                  option.isCorrect ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                                }`}>
                                  {String.fromCharCode(65 + optIndex)}
                                </span>
                                <span className="text-gray-900">{option.text}</span>
                                {option.isCorrect && (
                                  <span className="text-xs text-green-600 font-medium">✓ Correct</span>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          {question.explanation && (
                            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm text-blue-800">
                                <strong>Explanation:</strong> {question.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEditModal(question)}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit Question"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
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
          size="xl"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Enter your question..."
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Complexity</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
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
                      onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <label className="flex items-center space-x-2">
                      <input
                        type={formData.type === 'single_choice' ? 'radio' : 'checkbox'}
                        name="correct-answer"
                        checked={option.isCorrect}
                        onChange={(e) => handleOptionChange(index, 'isCorrect', e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">Correct</span>
                    </label>
                    {formData.options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {formData.options.length < 6 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addOption}
                  className="mt-3"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Option
                </Button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
              <textarea
                value={formData.explanation}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                placeholder="Provide an explanation for the correct answer..."
                rows={2}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
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
          size="xl"
        >
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="Enter your question..."
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Complexity</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
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
                      onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <label className="flex items-center space-x-2">
                      <input
                        type={formData.type === 'single_choice' ? 'radio' : 'checkbox'}
                        name="correct-answer"
                        checked={option.isCorrect}
                        onChange={(e) => handleOptionChange(index, 'isCorrect', e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">Correct</span>
                    </label>
                    {formData.options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {formData.options.length < 6 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={addOption}
                  className="mt-3"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Option
                </Button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
              <textarea
                value={formData.explanation}
                onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                placeholder="Provide an explanation for the correct answer..."
                rows={2}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
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

        {/* Create Section Modal */}
        <Modal
          isOpen={isSectionModalOpen}
          onClose={() => {
            setIsSectionModalOpen(false);
            resetSectionForm();
          }}
          title="Create New Section"
          size="lg"
        >
          <div className="space-y-4">
            <Input
              label="Section Title"
              value={sectionFormData.title}
              onChange={(e) => setSectionFormData({ ...sectionFormData, title: e.target.value })}
              placeholder="Enter section title"
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={sectionFormData.description}
                onChange={(e) => setSectionFormData({ ...sectionFormData, description: e.target.value })}
                placeholder="Enter section description"
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Target Questions Count"
                type="number"
                min="1"
                value={sectionFormData.questionsCount}
                onChange={(e) => setSectionFormData({ ...sectionFormData, questionsCount: parseInt(e.target.value) })}
                placeholder="Number of questions for this section"
              />
              <Input
                label="Section Order"
                type="number"
                min="1"
                value={sectionFormData.sectionOrder}
                onChange={(e) => setSectionFormData({ ...sectionFormData, sectionOrder: parseInt(e.target.value) })}
                placeholder="Display order of this section"
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Section Information</h4>
              <p className="text-sm text-blue-800">
                This section will be part of "{selectedSurveyData?.title}". The questions count determines how many questions will be randomly selected from this section during tests.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsSectionModalOpen(false);
                  resetSectionForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateSection}>
                Create Section
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Section Modal */}
        <Modal
          isOpen={isEditSectionModalOpen}
          onClose={() => {
            setIsEditSectionModalOpen(false);
            resetSectionForm();
          }}
          title="Edit Section"
          size="lg"
        >
          <div className="space-y-4">
            <Input
              label="Section Title"
              value={sectionFormData.title}
              onChange={(e) => setSectionFormData({ ...sectionFormData, title: e.target.value })}
              placeholder="Enter section title"
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={sectionFormData.description}
                onChange={(e) => setSectionFormData({ ...sectionFormData, description: e.target.value })}
                placeholder="Enter section description"
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Target Questions Count"
                type="number"
                min="1"
                value={sectionFormData.questionsCount}
                onChange={(e) => setSectionFormData({ ...sectionFormData, questionsCount: parseInt(e.target.value) })}
                placeholder="Number of questions for this section"
              />
              <Input
                label="Section Order"
                type="number"
                min="1"
                value={sectionFormData.sectionOrder}
                onChange={(e) => setSectionFormData({ ...sectionFormData, sectionOrder: parseInt(e.target.value) })}
                placeholder="Display order of this section"
              />
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">Current Section Status</h4>
              <div className="text-sm text-yellow-800 space-y-1">
                <p>Current Questions: {questions.length}</p>
                <p>Target Questions: {sectionFormData.questionsCount}</p>
                {questions.length !== sectionFormData.questionsCount && (
                  <p className="font-medium">
                    {questions.length < sectionFormData.questionsCount 
                      ? `Need ${sectionFormData.questionsCount - questions.length} more questions`
                      : `${questions.length - sectionFormData.questionsCount} questions above target`
                    }
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="danger"
                onClick={() => {
                  if (selectedSectionForEdit) {
                    handleDeleteSection(selectedSectionForEdit.id);
                    setIsEditSectionModalOpen(false);
                    resetSectionForm();
                  }
                }}
                className="mr-auto"
              >
                Delete Section
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditSectionModalOpen(false);
                  resetSectionForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleEditSection}>
                Update Section
              </Button>
            </div>
          </div>
        </Modal>

        {/* Upload Modal */}
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          title="Bulk Upload Questions"
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Upload Questions</h4>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownloadTemplate}
                className="flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Template</span>
              </Button>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">CSV Format Requirements</h4>
              <p className="text-sm text-blue-800 mb-2">Your CSV file should have the following columns:</p>
              <div className="text-xs text-blue-700 font-mono bg-blue-100 p-2 rounded">
                Question,Type,Complexity,OptionA,OptionB,OptionC,OptionD,CorrectAnswer,Points,Explanation
              </div>
              <p className="text-xs text-blue-700 mt-2">
                Download the template above to get a CSV file with existing questions from this section, or use it as a format reference for new questions.
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
              <input
                type="file"
                accept=".csv"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setIsUploadModalOpen(false)}
              >
                Cancel
              </Button>
              <Button>
                Upload Questions
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}