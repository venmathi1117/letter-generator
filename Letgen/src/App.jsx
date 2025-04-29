import { BrowserRouter, Routes, Route } from 'react-router-dom';  
import Signup from './Signup';  
import Login from './Login';  
import Dashboard from './Dashboard';
import 'bootstrap/dist/css/bootstrap.min.css';  

function App() {  
  return (  
    <BrowserRouter>  
      <Routes>  
        <Route path='/' element={<Login/>}/>
        <Route path='/register' element={<Signup />} />  
        <Route path='/login' element={<Login />} />
        <Route path='/dashboard' element={<Dashboard />} />  
      </Routes>  
    </BrowserRouter>  
  );  
}  

export default App;  