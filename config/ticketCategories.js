// src/config/ticketCategories.js

module.exports = {
  categories: [
    {
      label: 'General Support',
      value: 'general-support',
      description: 'Any reports, general inquiries or questions.',
      categoryName: '🎫・general-support',
      emoji: '🎫',
      supportOnly: true // Support role can respond
    },
    {
      label: 'Role Request',
      value: 'role-request',
      description: 'Request a role or tag.',
      categoryName: '🎫・role-requests',
      emoji: '🏷️',
      supportOnly: true
    },
    {
      label: 'Org Role Creation',
      value: 'org-role-creation',
      description: 'Create a role for your organization/business.',
      categoryName: '🎫・org-roles',
      emoji: '🏢',
      supportOnly: true
    },
    {
      label: 'Contact Owners',
      value: 'contact-owners',
      description: 'Important matters, investments, or sponsorships.',
      categoryName: '🔐・owner-contact',
      emoji: '👑',
      adminOnly: true // Only Admins can respond
    },
    {
      label: 'Staff Application',
      value: 'staff-application',
      description: 'Apply for staff or management positions.',
      categoryName: '🎫・staff-apps',
      emoji: '💼',
      supportOnly: true
    }
  ]
};
