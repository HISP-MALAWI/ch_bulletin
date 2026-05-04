import React from 'react'
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useDataQuery } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import classes from './App.module.css'
import HomePage from './Pages/home'
import BulletinForm from './Pages/newBulletin'

const query = {
    me: { resource: 'me' },
}

const MyApp = () => {
    const { error, loading } = useDataQuery(query)

    if (error) return <span>{i18n.t('ERROR')}</span>
    if (loading) return <span>{i18n.t('Loading...')}</span>

    return (
        <HashRouter>
            <div className={classes.container}>
                {/* Sidebar Navigation */}
                <aside className={classes.sidebar}>
                    <NavLink 
                        to="/" 
                        className={({ isActive }) => 
                            isActive ? `${classes.navItem} ${classes.navItemActive}` : classes.navItem
                        }
                    >
                        {i18n.t('Home')}
                    </NavLink>

                    <NavLink 
                        to="/drafts" 
                        className={({ isActive }) => 
                            isActive ? `${classes.navItem} ${classes.navItemActive}` : classes.navItem
                        }
                    >
                        {i18n.t('Drafts')}
                    </NavLink>

                    <NavLink 
                        to="/settings" 
                        className={({ isActive }) => 
                            isActive ? `${classes.navItem} ${classes.navItemActive}` : classes.navItem
                        }
                    >
                        {i18n.t('Settings')}
                    </NavLink>
                </aside>

                <Routes>
                    <Route path="/" element={<HomePage style={classes}/>} />
                    <Route path="/new-bulletin" element={<BulletinForm style={classes}/>} />
                    </Routes>
            </div>
        </HashRouter>
    )
}

export default MyApp